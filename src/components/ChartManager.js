// Chart Manager - Handles data visualization using Chart.js
export class ChartManager {
  constructor() {
    this.charts = {};
    this.isChartJSLoaded = false;
  }

  async init() {
    try {
      await this.loadChartJS();
    } catch (error) {
      console.warn('ChartManager initialization failed, charts disabled:', error);
      // Continue without charts rather than breaking the app
    }
  }

  async loadChartJS() {
    if (this.isChartJSLoaded) return;

    try {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
        
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          reject(new Error('Chart.js load timeout'));
        }, 10000); // 10 second timeout
        
        script.onload = () => {
          clearTimeout(timeout);
          this.isChartJSLoaded = true;
          console.log('Chart.js loaded successfully');
          resolve();
        };
        
        script.onerror = (error) => {
          clearTimeout(timeout);
          console.warn('Chart.js failed to load, charts will be disabled:', error);
          reject(error);
        };
        
        document.head.appendChild(script);
      });
    } catch (error) {
      console.warn('Chart.js loading failed, continuing without charts:', error);
      throw error;
    }
  }

  createCostComparisonChart(containerId, results) {
    if (!this.isChartJSLoaded || !results) return;

    const planIds = Object.keys(results);
    const sortedPlans = planIds.sort((a, b) => 
      results[a].familyTotals.totalWithPremiums - results[b].familyTotals.totalWithPremiums
    );

    const ctx = document.getElementById(containerId);
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts[containerId]) {
      this.charts[containerId].destroy();
    }

    const data = {
      labels: sortedPlans.map(id => results[id].planName),
      datasets: [
        {
          label: 'Annual Premium',
          data: sortedPlans.map(id => results[id].annualPremium),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          stack: 'Stack 0'
        },
        {
          label: 'Out-of-Pocket Costs',
          data: sortedPlans.map(id => results[id].familyTotals.totalOutOfPocket),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
          stack: 'Stack 0'
        }
      ]
    };

    const config = {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Annual Cost Breakdown by Plan',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'top'
          },
          tooltip: {
            callbacks: {
              footer: (tooltipItems) => {
                let total = 0;
                tooltipItems.forEach(item => total += item.raw);
                return `Total: ${this.formatCurrency(total)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Health Plans'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Annual Cost ($)'
            },
            ticks: {
              callback: (value) => this.formatCurrency(value)
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    };

    this.charts[containerId] = new Chart(ctx, config);
    return this.charts[containerId];
  }

  createScenarioComparisonChart(containerId, results) {
    if (!this.isChartJSLoaded || !results) return;

    const planIds = Object.keys(results);
    const ctx = document.getElementById(containerId);
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts[containerId]) {
      this.charts[containerId].destroy();
    }

    const scenarios = ['low', 'medium', 'high'];
    const colors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(236, 72, 153, 0.8)'
    ];

    const datasets = planIds.map((planId, index) => ({
      label: results[planId].planName,
      data: scenarios.map(scenario => {
        if (scenario === 'medium') {
          return results[planId].familyTotals.totalWithPremiums;
        }
        return results[planId].scenarios?.[scenario]?.totalWithPremiums || 0;
      }),
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length].replace('0.8', '1'),
      borderWidth: 1
    }));

    const config = {
      type: 'bar',
      data: {
        labels: scenarios.map(s => `${s.charAt(0).toUpperCase() + s.slice(1)} Usage`),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Plan Costs by Usage Scenario',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: ${this.formatCurrency(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Usage Scenarios'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Total Annual Cost ($)'
            },
            ticks: {
              callback: (value) => this.formatCurrency(value)
            },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    };

    this.charts[containerId] = new Chart(ctx, config);
    return this.charts[containerId];
  }

  createPieChart(containerId, results) {
    if (!this.isChartJSLoaded || !results) return;

    const planIds = Object.keys(results);
    const ctx = document.getElementById(containerId);
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts[containerId]) {
      this.charts[containerId].destroy();
    }

    const colors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(236, 72, 153, 0.8)'
    ];

    const config = {
      type: 'doughnut',
      data: {
        labels: planIds.map(id => results[id].planName),
        datasets: [{
          data: planIds.map(id => results[id].familyTotals.totalWithPremiums),
          backgroundColor: colors.slice(0, planIds.length),
          borderColor: colors.slice(0, planIds.length).map(color => color.replace('0.8', '1')),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Total Cost Distribution',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                const percentage = ((context.raw / total) * 100).toFixed(1);
                return `${context.label}: ${this.formatCurrency(context.raw)} (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    this.charts[containerId] = new Chart(ctx, config);
    return this.charts[containerId];
  }

  createMemberCostBreakdown(containerId, results, selectedPlanId) {
    if (!this.isChartJSLoaded || !results || !selectedPlanId) return;

    const planResult = results[selectedPlanId];
    const ctx = document.getElementById(containerId);
    if (!ctx || !planResult.memberResults) return;

    // Destroy existing chart if it exists
    if (this.charts[containerId]) {
      this.charts[containerId].destroy();
    }

    const members = Object.values(planResult.memberResults);
    const memberNames = members.map(m => m.memberName);
    
    const config = {
      type: 'bar',
      data: {
        labels: memberNames,
        datasets: [
          {
            label: 'Medical Costs',
            data: members.map(m => m.medicalCosts),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
          },
          {
            label: 'Prescription Costs',
            data: members.map(m => m.rxCosts),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Cost Breakdown by Family Member - ${planResult.planName}`,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Family Members'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Annual Cost ($)'
            },
            ticks: {
              callback: (value) => this.formatCurrency(value)
            }
          }
        }
      }
    };

    this.charts[containerId] = new Chart(ctx, config);
    return this.charts[containerId];
  }

  createCostTrendChart(containerId, results, calculator = null) {
    if (!this.isChartJSLoaded || !results) return;

    const ctx = document.getElementById(containerId);
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts[containerId]) {
      this.charts[containerId].destroy();
    }

    const planIds = Object.keys(results);

    // Use real progression data if available, otherwise fall back to monthly data
    if (calculator && calculator.lastPlanProgressions) {
      return this.createGranularTimelineChart(containerId, ctx, planIds, results, calculator);
    } else {
      return this.createMonthlyTimelineChart(containerId, ctx, planIds, results, calculator);
    }
  }

  createGranularTimelineChart(containerId, ctx, planIds, results, calculator) {
    const colors = [
      'rgb(59, 130, 246)',
      'rgb(16, 185, 129)', 
      'rgb(245, 158, 11)',
      'rgb(239, 68, 68)',
      'rgb(139, 92, 246)'
    ];

    const datasets = planIds.map((planId, index) => {
      const progression = calculator.lastPlanProgressions[planId];
      
      // Create data points from progression - sample every few days for performance
      const dataPoints = [];
      const labels = [];
      
      // Sample data points - take every 3rd event or so to avoid overcrowding
      const sampleRate = Math.max(1, Math.floor(progression.length / 100)); // Max 100 points
      
      for (let i = 0; i < progression.length; i += sampleRate) {
        const row = progression[i];
        dataPoints.push({
          x: row.day,
          y: row.cumulativeTotal
        });
      }
      
      // Always include the last point
      if (progression.length > 0) {
        const lastRow = progression[progression.length - 1];
        dataPoints.push({
          x: lastRow.day,
          y: lastRow.cumulativeTotal
        });
      }

      return {
        label: results[planId].planName,
        data: dataPoints,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 6
      };
    });

    const config = {
      type: 'line',
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Accumulated Costs Throughout Plan Year',
            font: { size: 18, weight: 'bold' }
          },
          subtitle: {
            display: true,
            text: 'Real-time progression showing when deductibles are met and costs accumulate',
            font: { size: 13 },
            color: '#666'
          },
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            callbacks: {
              title: (context) => {
                const day = context[0].parsed.x;
                const date = this.dayToDate(day);
                return `Day ${day} (${date})`;
              },
              label: (context) => {
                const planId = planIds[context.datasetIndex];
                const cost = context.parsed.y;
                
                // Find the exact progression row for this data point
                const progression = calculator.lastPlanProgressions[planId];
                const matchingRow = progression.find(row => 
                  Math.abs(row.day - context.parsed.x) < 1 && 
                  Math.abs(row.cumulativeTotal - cost) < 1
                );
                
                if (matchingRow) {
                  return [
                    `${context.dataset.label}: ${this.formatCurrency(cost)}`,
                    `  Premiums: ${this.formatCurrency(matchingRow.cumulativePremium)}`,
                    `  Out-of-Pocket: ${this.formatCurrency(matchingRow.cumulativeOOP)}`,
                    `  Family Deductible Used: ${this.formatCurrency(matchingRow.familyDeductibleUsed)}`
                  ];
                } else {
                  return `${context.dataset.label}: ${this.formatCurrency(cost)}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: 'Day of Plan Year'
            },
            min: 0,
            max: 365,
            ticks: {
              stepSize: 30,
              callback: (value) => {
                if (value === 0) return 'Start';
                if (value >= 365) return 'End';
                const month = Math.floor(value / 30.4) + 1;
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return monthNames[month - 1] || `Month ${month}`;
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'Accumulated Cost ($)'
            },
            ticks: {
              callback: (value) => this.formatCurrency(value)
            },
            beginAtZero: true
          }
        },
        elements: {
          point: {
            radius: 2,
            hoverRadius: 6
          }
        },
        interaction: {
          intersect: false,
          mode: 'nearest'
        }
      }
    };

    this.charts[containerId] = new Chart(ctx, config);
    return this.charts[containerId];
  }

  createMonthlyTimelineChart(containerId, ctx, planIds, results, calculator) {
    // Fallback to monthly data if progression data not available
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const datasets = planIds.map((planId, index) => {
      const result = results[planId];
      const monthlyData = this.calculateMonthlyAccumulation(result, calculator, planId);

      const colors = [
        'rgb(59, 130, 246)',
        'rgb(16, 185, 129)',
        'rgb(245, 158, 11)',
        'rgb(239, 68, 68)',
        'rgb(139, 92, 246)'
      ];

      return {
        label: result.planName,
        data: monthlyData,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 3,
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 8
      };
    });

    const config = {
      type: 'line',
      data: {
        labels: months,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Accumulated Costs Throughout Plan Year',
            font: { size: 18, weight: 'bold' }
          },
          subtitle: {
            display: true,
            text: 'Monthly progression of total costs (premiums + healthcare)',
            font: { size: 13 },
            color: '#666'
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Plan Year Month'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Accumulated Cost ($)'
            },
            ticks: {
              callback: (value) => this.formatCurrency(value)
            }
          }
        }
      }
    };

    this.charts[containerId] = new Chart(ctx, config);
    return this.charts[containerId];
  }

  dayToDate(day) {
    const date = new Date(2024, 0, 1);
    date.setDate(date.getDate() + day - 1);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  calculateMonthlyAccumulation(result, calculator = null, planId = null) {
    // First priority: Use real progression data from calculator if available
    if (calculator && calculator.lastPlanProgressions && planId && calculator.lastPlanProgressions[planId]) {
      return this.calculateProgressionAccumulation(calculator.lastPlanProgressions[planId]);
    }
    
    const annualPremium = result.annualPremium || 0;
    const monthlyPremium = annualPremium / 12;
    
    // Second priority: Use the REAL timeline data from result if available
    if (result.timeline && result.timeline.length > 0) {
      return this.calculateRealTimelineAccumulation(result);
    }
    
    // Third priority: use monthlyAccumulation from calculator if available
    if (result.monthlyAccumulation && result.monthlyAccumulation.length >= 12) {
      const monthlyData = [];
      for (let month = 0; month < 12; month++) {
        const monthData = result.monthlyAccumulation[month];
        const cumulativePremiums = monthlyPremium * (month + 1);
        const cumulativeHealthcare = monthData.totalCost || 0;
        monthlyData.push(cumulativePremiums + cumulativeHealthcare);
      }
      return monthlyData;
    }
    
    // Last resort: create basic linear progression (should rarely be used)
    console.warn('No progression data available, using fallback calculation for chart');
    const monthlyData = [];
    const totalHealthcareCost = result.familyTotals.totalOutOfPocket || 0;
    
    for (let month = 0; month < 12; month++) {
      const cumulativePremiums = monthlyPremium * (month + 1);
      const cumulativeHealthcare = (totalHealthcareCost * (month + 1)) / 12;
      monthlyData.push(cumulativePremiums + cumulativeHealthcare);
    }
    
    return monthlyData;
  }

  calculateProgressionAccumulation(progression) {
    // Use the actual progression data from the new CostCalculator
    const monthlyData = new Array(12).fill(0);
    
    // Group progression events by month and take the latest cumulative total for each month
    for (let month = 0; month < 12; month++) {
      const monthEndDay = (month + 1) * 30.4;
      
      // Find all events up to the end of this month
      const eventsUpToMonth = progression.filter(row => row.day <= monthEndDay);
      
      if (eventsUpToMonth.length > 0) {
        // Get the latest event in this month period for the most accurate cumulative total
        const latestEvent = eventsUpToMonth[eventsUpToMonth.length - 1];
        monthlyData[month] = latestEvent.cumulativeTotal || 0;
      } else if (month > 0) {
        // If no events in this month, use previous month's total
        monthlyData[month] = monthlyData[month - 1];
      }
    }
    
    // Ensure monotonic increase (handle any edge cases)
    for (let month = 1; month < 12; month++) {
      monthlyData[month] = Math.max(monthlyData[month], monthlyData[month - 1]);
    }
    
    return monthlyData;
  }

  calculateRealTimelineAccumulation(result) {
    const timeline = result.timeline;
    const annualPremium = result.annualPremium || 0;
    const monthlyPremium = annualPremium / 12;
    
    // Initialize monthly accumulation array
    const monthlyData = new Array(12).fill(0);
    
    // Track running totals
    let cumulativeHealthcare = 0;
    
    // Process each event in the timeline
    timeline.forEach(event => {
      const month = Math.floor(event.day / 30.4); // Convert day to month (0-11)
      if (month < 12) {
        // Find corresponding event cost from member results
        const memberResult = result.memberResults[event.memberId];
        if (memberResult && memberResult.events) {
          const matchingEvent = memberResult.events.find(e => 
            e.day === event.day && 
            e.type === event.type &&
            (e.serviceType === event.serviceType || e.serviceType === event.medicationName)
          );
          
          if (matchingEvent) {
            cumulativeHealthcare += matchingEvent.memberCost || 0;
          }
        }
        
        // Update all months from this month forward
        for (let m = month; m < 12; m++) {
          const cumulativePremiums = monthlyPremium * (m + 1);
          monthlyData[m] = cumulativePremiums + cumulativeHealthcare;
        }
      }
    });
    
    // Apply family OOP maximum
    const familyOOPMax = result.planDetails?.familyOOPMax || result.planDetails?.individualOOPMax * 2 || Infinity;
    if (familyOOPMax < Infinity) {
      for (let month = 0; month < 12; month++) {
        const cumulativePremiums = monthlyPremium * (month + 1);
        const cumulativeHealthcare = monthlyData[month] - cumulativePremiums;
        const cappedHealthcare = Math.min(cumulativeHealthcare, familyOOPMax);
        monthlyData[month] = cumulativePremiums + cappedHealthcare;
      }
    }
    
    return monthlyData;
  }

  extractPlanDataFromResult(result) {
    // Use the planDetails that CostCalculator now includes
    const planDetails = result.planDetails || {};
    
    // Determine appropriate deductible based on coverage type
    let deductible = 0;
    let oopMax = 0;
    
    if (result.coverageType === 'individual') {
      deductible = planDetails.individualDeductible || 0;
      oopMax = planDetails.individualOOPMax || 0;
    } else if (result.coverageType === 'employee+spouse') {
      // For employee+spouse, use family limits but they might hit individual limits first
      deductible = Math.min(
        planDetails.familyDeductible || planDetails.individualDeductible * 2,
        planDetails.individualDeductible * 2 // Two individuals
      );
      oopMax = Math.min(
        planDetails.familyOOPMax || planDetails.individualOOPMax * 2,
        planDetails.individualOOPMax * 2
      );
    } else { // family
      deductible = planDetails.familyDeductible || planDetails.individualDeductible * 2;
      oopMax = planDetails.familyOOPMax || planDetails.individualOOPMax * 2;
    }
    
    const coinsurance = planDetails.coinsurance || 0.2;
    
    return {
      deductible,
      oopMax,
      coinsurance,
      planDetails
    };
  }


  getMonthlyBreakdown(result, month, calculator = null, planId = null) {
    const annualPremium = result.annualPremium || 0;
    const monthlyPremium = annualPremium / 12;
    const premiums = monthlyPremium * (month + 1);
    
    const monthlyData = this.calculateMonthlyAccumulation(result, calculator, planId);
    const totalAccumulated = monthlyData[month];
    const healthcare = totalAccumulated - premiums;
    
    // Use real milestone data from the timeline calculator if available
    let deductibleMet = false;
    let oopMaxReached = false;
    let deductibleRemaining = 0;
    let oopRemaining = 0;
    
    if (result.milestones && result.timeline) {
      // Calculate the day number for end of this month
      const endOfMonthDay = (month + 1) * 30.4;
      
      // Check milestones that occurred by this point in the year
      const milestonesThisMonth = result.milestones.filter(m => m.day <= endOfMonthDay);
      
      deductibleMet = milestonesThisMonth.some(m => 
        m.type === 'family_deductible_met' || m.type === 'individual_deductible_met'
      );
      
      oopMaxReached = milestonesThisMonth.some(m => 
        m.type === 'family_oop_met' || m.type === 'individual_oop_met'
      );
      
      // Get actual remaining amounts from plan details
      const planData = this.extractPlanDataFromResult(result);
      deductibleRemaining = Math.max(0, planData.deductible - healthcare);
      oopRemaining = Math.max(0, planData.oopMax - healthcare);
    } else {
      // Fallback to estimated calculation
      const planData = this.extractPlanDataFromResult(result);
      deductibleRemaining = Math.max(0, planData.deductible - healthcare);
      oopRemaining = Math.max(0, planData.oopMax - healthcare);
      deductibleMet = healthcare >= planData.deductible;
      oopMaxReached = healthcare >= planData.oopMax;
    }
    
    return {
      premiums: premiums,
      healthcare: healthcare,
      deductibleMet: deductibleMet,
      oopMaxReached: oopMaxReached,
      deductibleRemaining: deductibleRemaining,
      oopRemaining: oopRemaining
    };
  }

  destroyChart(containerId) {
    if (this.charts[containerId]) {
      this.charts[containerId].destroy();
      delete this.charts[containerId];
    }
  }

  destroyAllCharts() {
    Object.keys(this.charts).forEach(id => {
      this.destroyChart(id);
    });
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  // Generate chart containers HTML
  static generateChartContainers() {
    return `
      <!-- Main Chart: Accumulated Costs Throughout Plan Year -->
      <div class="bg-white rounded-lg shadow p-6 mb-8">
        <div style="height: 450px;">
          <canvas id="cost-trend-chart"></canvas>
        </div>
      </div>

      <!-- Secondary Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
          <div style="height: 350px;">
            <canvas id="cost-comparison-chart"></canvas>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div style="height: 350px;">
            <canvas id="scenario-comparison-chart"></canvas>
          </div>
        </div>
      </div>
    `;
  }
}
