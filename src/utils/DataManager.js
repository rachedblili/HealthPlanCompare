// Data Manager - Handles import/export and data visualization
export class DataManager {
  static async exportConfiguration(plans, familyData) {
    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      metadata: {
        planCount: plans.length,
        activeMemberCount: familyData.members.filter(m => m.isActive).length,
        exportedBy: 'Health Plan Comparison Tool v2.0'
      },
      plans: plans,
      familyData: familyData,
      settings: {
        currency: 'USD',
        locale: 'en-US'
      }
    };

    return exportData;
  }

  static async importConfiguration(data) {
    // Validate import data structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data format');
    }

    if (!data.version) {
      throw new Error('Import data missing version information');
    }

    // Handle different versions
    let normalizedData;
    switch (data.version) {
      case '1.0':
        normalizedData = this.migrateV1ToV2(data);
        break;
      case '2.0':
        normalizedData = data;
        break;
      default:
        throw new Error(`Unsupported data version: ${data.version}`);
    }

    // Validate required fields
    if (!normalizedData.plans || !Array.isArray(normalizedData.plans)) {
      throw new Error('Import data missing valid plans array');
    }

    if (!normalizedData.familyData || !normalizedData.familyData.members) {
      throw new Error('Import data missing valid family data');
    }

    return {
      plans: normalizedData.plans,
      familyData: normalizedData.familyData,
      metadata: normalizedData.metadata
    };
  }

  static migrateV1ToV2(v1Data) {
    // Convert old format to new format
    return {
      version: '2.0',
      plans: v1Data.plans || [],
      familyData: {
        members: v1Data.familyData?.members || [],
        serviceCosts: v1Data.familyData?.serviceCosts || {}
      },
      metadata: {
        migratedFrom: 'v1.0',
        migrationDate: new Date().toISOString()
      }
    };
  }

  static async generateShareableLink(plans, familyData) {
    try {
      const data = await this.exportConfiguration(plans, familyData);
      const compressed = await this.compressData(data);
      const encoded = btoa(compressed);
      
      // Create shareable URL with encoded data
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}?data=${encoded}`;
    } catch (error) {
      console.error('Failed to generate shareable link:', error);
      throw new Error('Unable to create shareable link');
    }
  }

  static async loadFromShareableLink() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const encoded = urlParams.get('data');
      
      if (!encoded) return null;
      
      const compressed = atob(encoded);
      const data = await this.decompressData(compressed);
      
      return await this.importConfiguration(data);
    } catch (error) {
      console.error('Failed to load from shareable link:', error);
      return null;
    }
  }

  static async compressData(data) {
    // Simple compression using JSON stringify + minimal encoding
    // In a real implementation, you might use a library like pako for gzip compression
    return JSON.stringify(data);
  }

  static async decompressData(compressed) {
    try {
      return JSON.parse(compressed);
    } catch (error) {
      throw new Error('Invalid compressed data format');
    }
  }

  static downloadFile(data, filename, mimeType = 'application/json') {
    try {
      let content;
      if (typeof data === 'string') {
        content = data;
      } else {
        // Safe JSON serialization with size limits
        content = JSON.stringify(data, (key, value) => {
          // Additional safety filter for any missed problematic objects
          if (typeof value === 'function' || 
              value instanceof HTMLElement || 
              value instanceof Event ||
              value instanceof Node) {
            return undefined;
          }
          return value;
        }, 2);
      }
      
      // Check size limit (50MB)
      if (content.length > 50 * 1024 * 1024) {
        throw new Error('Export data too large (>50MB). Please reduce your data set.');
      }
      
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link); // Ensure link is in DOM
      link.click();
      document.body.removeChild(link); // Clean up DOM
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error('Failed to create download file: ' + error.message);
    }
  }

  static async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static generateCSVReport(results) {
    if (!results || Object.keys(results).length === 0) {
      throw new Error('No results to export');
    }

    const planIds = Object.keys(results);
    const headers = [
      'Plan Name',
      'Insurer', 
      'Annual Premium',
      'Medical Costs',
      'Prescription Costs',
      'Total Out-of-Pocket',
      'Total Annual Cost',
      'Rank'
    ];

    const rows = planIds.map(planId => {
      const result = results[planId];
      return [
        result.planName,
        result.insurer,
        result.annualPremium,
        result.familyTotals.medicalCosts,
        result.familyTotals.rxCosts,
        result.familyTotals.totalOutOfPocket,
        result.familyTotals.totalWithPremiums,
        result.comparison?.rank || 'N/A'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  static generatePDFReport(results, familyData) {
    // This would integrate with a PDF library like jsPDF
    // For now, return formatted text that could be converted to PDF
    
    const planIds = Object.keys(results);
    const sortedPlans = planIds.sort((a, b) => 
      results[a].familyTotals.totalWithPremiums - results[b].familyTotals.totalWithPremiums
    );
    
    const bestPlan = results[sortedPlans[0]];
    const activeMemberCount = familyData.members.filter(m => m.isActive).length;
    
    return `
HEALTH PLAN COMPARISON REPORT
Generated: ${new Date().toLocaleDateString()}
Family Size: ${activeMemberCount} members

SUMMARY
Recommended Plan: ${bestPlan.planName}
Total Annual Cost: $${bestPlan.familyTotals.totalWithPremiums.toLocaleString()}

PLAN COMPARISON
${sortedPlans.map((planId, index) => {
  const plan = results[planId];
  return `${index + 1}. ${plan.planName}
   Insurer: ${plan.insurer}
   Annual Premium: $${plan.annualPremium.toLocaleString()}
   Out-of-Pocket: $${plan.familyTotals.totalOutOfPocket.toLocaleString()}
   Total Cost: $${plan.familyTotals.totalWithPremiums.toLocaleString()}
   ${plan.comparison.isBest ? '⭐ BEST VALUE' : ''}`;
}).join('\n\n')}

FAMILY USAGE SUMMARY
${familyData.members.filter(m => m.isActive).map(member => `
${member.name} (${member.relationship}, age ${member.age})
- Primary care visits: ${member.primaryVisits}
- Specialist visits: ${member.specialistVisits}
- Therapy sessions: ${member.therapyVisits}
- Medications: ${member.medications.length}
`).join('')}

This report was generated by the Health Plan Comparison Tool.
For the most up-to-date comparison, visit: ${window.location.href}
    `;
  }

  static createVisualizationData(results) {
    if (!results) return null;

    const planIds = Object.keys(results);
    const chartData = {
      labels: planIds.map(id => results[id].planName),
      datasets: [
        {
          label: 'Annual Premium',
          data: planIds.map(id => results[id].annualPremium),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1
        },
        {
          label: 'Out-of-Pocket Costs',
          data: planIds.map(id => results[id].familyTotals.totalOutOfPocket),
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1
        }
      ]
    };

    const pieData = {
      labels: planIds.map(id => results[id].planName),
      datasets: [{
        data: planIds.map(id => results[id].familyTotals.totalWithPremiums),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ]
      }]
    };

    return { chartData, pieData };
  }

  static generateInsights(results, familyData) {
    if (!results) return [];

    const insights = [];
    const planIds = Object.keys(results);
    const totalCosts = planIds.map(id => results[id].familyTotals.totalWithPremiums);
    
    // Cost range insight
    const minCost = Math.min(...totalCosts);
    const maxCost = Math.max(...totalCosts);
    const costRange = maxCost - minCost;
    
    if (costRange > 5000) {
      insights.push({
        type: 'warning',
        title: 'Significant Cost Variation',
        message: `There's a \$${costRange.toLocaleString()} difference between your cheapest and most expensive plan options. Choosing the right plan could save you significant money.`
      });
    }

    // High medication usage insight
    const totalMedications = familyData.members.reduce((sum, member) => 
      sum + (member.medications?.length || 0), 0);
    
    if (totalMedications > 3) {
      insights.push({
        type: 'info',
        title: 'Medication Coverage Important',
        message: `Your family uses ${totalMedications} medications. Pay special attention to prescription drug coverage and formularies when choosing a plan.`
      });
    }

    // Therapy usage insight
    const totalTherapy = familyData.members.reduce((sum, member) => 
      sum + (member.therapyVisits || 0), 0);
    
    if (totalTherapy > 50) {
      insights.push({
        type: 'info',
        title: 'Mental Health Coverage',
        message: `Your family has significant mental health service usage (${totalTherapy} sessions annually). Ensure your chosen plan has good mental health coverage.`
      });
    }

    // Premium vs out-of-pocket insight
    const bestPlan = results[planIds.find(id => results[id].comparison.isBest)];
    const premiumRatio = bestPlan.annualPremium / bestPlan.familyTotals.totalWithPremiums;
    
    if (premiumRatio < 0.3) {
      insights.push({
        type: 'tip',
        title: 'High Usage Justifies Lower Premium Plan',
        message: `Your high healthcare usage means most of your costs come from medical services rather than premiums. Lower premium plans with higher deductibles may be more cost-effective.`
      });
    } else if (premiumRatio > 0.7) {
      insights.push({
        type: 'tip',
        title: 'Consider Higher Premium for Lower Out-of-Pocket',
        message: `Your lower healthcare usage means a higher premium plan with better coverage might provide more predictable costs.`
      });
    }

    return insights;
  }
}
