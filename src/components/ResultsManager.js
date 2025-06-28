// Results Manager Component - Displays calculation results and recommendations
import { EventEmitter } from '../utils/EventEmitter.js';
import { ChartManager } from './ChartManager.js';
import { DataManager } from '../utils/DataManager.js';
import { LLMAssistant } from '../utils/LLMAssistant.js';
import { serverlessLLM } from '../utils/ServerlessLLMClient.js';
import { WarningBanner } from './WarningBanner.js';

export class ResultsManager extends EventEmitter {
  constructor() {
    super();
    this.results = null;
    this.currentView = 'summary'; // 'summary', 'detailed', 'scenarios', 'charts'
    this.chartManager = new ChartManager();
    this.llmAssistant = new LLMAssistant();
    this.llmInsights = null;
    this.calculator = null; // Will be set by App.js
    this.initializeLLM();
  }

  initializeLLM() {
    // Check for existing LLM configuration
    const existingConfig = LLMAssistant.checkExistingConfig();
    if (existingConfig) {
      this.llmAssistant.configure(existingConfig.apiKey, existingConfig.provider);
    }
  }

  async init() {
    await this.chartManager.init();
    this.render();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const container = document.getElementById('results-container');
    
    // View switching
    container.addEventListener('click', (e) => {
      if (e.target.matches('[data-view]')) {
        const view = e.target.dataset.view;
        this.switchView(view);
      }
      
      if (e.target.matches('[data-action="export-results"]')) {
        this.exportResults();
      }
      
      if (e.target.matches('[data-action="export-csv"]')) {
        this.exportCSV();
      }
      
      if (e.target.matches('[data-action="export-pdf"]')) {
        this.exportPDF();
      }
      
      if (e.target.matches('[data-action="print-results"]')) {
        this.printResults();
      }
      
      
      if (e.target.matches('[data-action="export-debug-worksheets"]')) {
        this.exportDebugWorksheets();
      }
      
      // Handle dropdown toggles
      if (e.target.matches('[data-dropdown]')) {
        const dropdownName = e.target.dataset.dropdown;
        this.toggleDropdown(dropdownName, e.target);
      }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.matches('[data-dropdown]') && !e.target.closest('.dropdown-menu')) {
        this.closeAllDropdowns();
      }
    });
  }

  async switchView(view) {
    this.currentView = view;
    
    this.renderResults();
    
    // Initialize chart when switching to summary view (which now contains the chart)
    if (view === 'summary' && this.results) {
      setTimeout(() => this.initializeSummaryChart(), 100);
    }
    
    // Initialize insights when switching to detailed view
    if (view === 'detailed' && this.results) {
      setTimeout(() => this.displayDetailedInsights(), 100);
    }
  }

  initializeSummaryChart() {
    if (!this.results) return;

    // Create the accumulated costs chart in the summary view
    this.chartManager.createCostTrendChart('summary-cost-trend-chart', this.results, this.calculator);
  }

  displayDetailedInsights() {
    const insightsContainer = document.getElementById('detailed-insights-container');
    if (!insightsContainer || !this.results) return;

    // Get family data from storage or emit request
    this.emit('requestFamilyData', (familyData) => {
      const insights = DataManager.generateInsights(this.results, familyData);
      
      insightsContainer.innerHTML = insights.map(insight => `
        <div class="border-l-4 ${this.getInsightBorderColor(insight.type)} bg-gray-50 p-4 rounded-r">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              ${this.getInsightIcon(insight.type)}
            </div>
            <div class="ml-3">
              <h4 class="font-medium text-gray-900">${insight.title}</h4>
              <p class="text-gray-700 text-sm mt-1">${insight.message}</p>
            </div>
          </div>
        </div>
      `).join('');
    });
  }

  async displayResults(results) {
    this.results = results;
    console.log('📊 Displaying results:', Object.keys(results).length, 'plans');
    
    // Render results immediately
    this.renderResults();
    
    // Initialize chart if we're on the summary view (default view)
    if (this.currentView === 'summary') {
      setTimeout(() => this.initializeSummaryChart(), 100);
    }
  }

  setCalculator(calculator) {
    this.calculator = calculator;
  }

  exportDebugWorksheets() {
    if (!this.calculator) {
      console.warn('Calculator not available for debug export');
      alert('Calculator not available. Please run a calculation first.');
      return;
    }

    try {
      const exportData = this.calculator.exportCalculationWorksheets();
      if (exportData) {
        console.log('📊 Debug calculation worksheets exported successfully');
        alert('Calculation worksheets exported! Check your downloads folder.');
      } else {
        alert('No calculation data available to export. Please run a calculation first.');
      }
    } catch (error) {
      console.error('❌ Failed to export debug worksheets:', error);
      alert('Failed to export calculation worksheets. Check console for details.');
    }
  }

  exportResults() {
    if (!this.results) {
      alert('No results available to export. Please run a calculation first.');
      return;
    }

    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        exportType: 'health-plan-results',
        version: '2.0',
        results: this.results
      };

      const filename = `health-plan-results-${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('📊 Results exported successfully');
      alert('Results exported successfully! Check your downloads folder.');
    } catch (error) {
      console.error('❌ Failed to export results:', error);
      alert('Failed to export results. Check console for details.');
    }
  }

  exportCSV() {
    if (!this.results) {
      alert('No results available to export. Please run a calculation first.');
      return;
    }

    try {
      // Generate CSV from results
      const planIds = Object.keys(this.results);
      let csvContent = 'Plan Name,Insurer,Coverage Type,Monthly Premium,Annual Premium,Out-of-Pocket,Total Cost,Rank\n';
      
      planIds.forEach(planId => {
        const result = this.results[planId];
        const row = [
          `"${result.planName || 'Unknown'}"`,
          `"${result.insurer || 'Unknown'}"`,
          `"${result.coverageType || 'Unknown'}"`,
          Math.round((result.annualPremium || 0) / 12),
          result.annualPremium || 0,
          result.familyTotals?.totalOutOfPocket || 0,
          result.familyTotals?.totalWithPremiums || 0,
          result.comparison?.rank || 'N/A'
        ].join(',');
        csvContent += row + '\n';
      });

      const filename = `health-plan-comparison-${new Date().toISOString().split('T')[0]}.csv`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('📊 CSV exported successfully');
      alert('CSV report exported successfully! Check your downloads folder.');
    } catch (error) {
      console.error('❌ Failed to export CSV:', error);
      alert('Failed to export CSV. Check console for details.');
    }
  }

  exportPDF() {
    alert('PDF export feature coming soon! For now, use the Print button to create a PDF via your browser.');
  }

  printResults() {
    if (!this.results) {
      alert('No results available to print. Please run a calculation first.');
      return;
    }
    window.print();
  }


  toggleDropdown(dropdownName, button) {
    const dropdownMenu = button.parentElement.querySelector('.dropdown-menu');
    if (!dropdownMenu) return;
    
    // Close other dropdowns first
    this.closeAllDropdowns();
    
    // Toggle current dropdown
    if (dropdownMenu.classList.contains('hidden')) {
      dropdownMenu.classList.remove('hidden');
      button.setAttribute('aria-expanded', 'true');
    } else {
      dropdownMenu.classList.add('hidden');
      button.setAttribute('aria-expanded', 'false');
    }
  }

  closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    const toggles = document.querySelectorAll('[data-dropdown]');
    
    dropdowns.forEach(dropdown => dropdown.classList.add('hidden'));
    toggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
  }

  async generateLLMInsights() {
    try {
      // Get family data and plan data for context
      this.emit('requestFamilyData', async (familyData) => {
        this.emit('requestPlanData', async (planData) => {
          console.log('🤖 Generating serverless AI insights for comparison...');
          
          // Show progress indicator
          const progressContainer = document.getElementById('llm-insights-container');
          if (progressContainer) {
            progressContainer.innerHTML = `
              <div class="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                <span class="text-blue-700">Generating AI insights...</span>
              </div>
            `;
          }
          
          try {
            // Try serverless insights first
            const result = await serverlessLLM.generateInsights(planData, familyData, this.results, {
              provider: 'openai',
              showProgress: (message, type) => {
                console.log(`💡 ${message}`);
                if (progressContainer) {
                  const isError = type === 'error';
                  progressContainer.innerHTML = `
                    <div class="flex items-center justify-center p-4 ${isError ? 'bg-red-50' : 'bg-blue-50'} rounded-lg">
                      ${!isError ? '<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>' : ''}
                      <span class="${isError ? 'text-red-700' : 'text-blue-700'}">${message}</span>
                    </div>
                  `;
                }
              }
            });
            
            if (result && result.success) {
              this.llmInsights = result.data;
              console.log('✅ Serverless AI insights generated');
            }
          } catch (error) {
            console.warn('🤖 Serverless insights failed, trying fallback:', error.message);
            
            // Fall back to old LLM assistant
            if (this.llmAssistant.isAvailable()) {
              try {
                this.llmInsights = await this.llmAssistant.generateComparisonInsights(this.results, familyData);
                if (this.llmInsights) {
                  console.log('✅ Fallback AI insights generated');
                }
              } catch (fallbackError) {
                console.error('❌ Both serverless and fallback insights failed:', fallbackError);
                if (progressContainer) {
                  progressContainer.innerHTML = `
                    <div class="p-4 bg-yellow-50 rounded-lg">
                      <span class="text-yellow-700">AI insights are temporarily unavailable. Please try again later.</span>
                    </div>
                  `;
                }
              }
            }
          }
          
          // Re-render to include the insights
          if (this.llmInsights) {
            this.renderResults();
          }
        });
      });
    } catch (error) {
      console.error('Failed to generate LLM insights:', error);
    }
  }

  hashResults(results) {
    // Create a simple hash of the results to detect changes
    // We'll hash the key metrics that matter for insights
    const keyData = Object.keys(results).map(planId => {
      const result = results[planId];
      return {
        planId: result.planId,
        planName: result.planName,
        annualPremium: result.annualPremium,
        totalWithPremiums: result.familyTotals?.totalWithPremiums,
        totalOutOfPocket: result.familyTotals?.totalOutOfPocket,
        coverageType: result.coverageType
      };
    });
    
    // Simple hash function
    const str = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  showNoPlansMessage() {
    const container = document.getElementById('results-container');
    container.innerHTML = `
      <div class="text-center py-12">
        <svg class="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v6a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z"/>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Plans to Compare</h3>
        <p class="text-gray-600">Add some health plans in the "Your Plans" tab to see cost comparisons.</p>
      </div>
    `;
  }

  showError(message) {
    const container = document.getElementById('results-container');
    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-6">
        <div class="flex items-center">
          <svg class="h-6 w-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <h3 class="text-lg font-medium text-red-800">Calculation Error</h3>
            <p class="text-red-700">${message}</p>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const container = document.getElementById('results-container');
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-semibold">Comparison Results</h2>
          <div class="flex space-x-2">
            <div class="relative">
              <button class="text-gray-600 hover:text-gray-800 px-3 py-1 text-sm border rounded dropdown-toggle" 
                      data-dropdown="export"
                      aria-expanded="false"
                      aria-haspopup="true"
                      type="button">
                Export ▼
              </button>
              <div class="dropdown-menu hidden absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
                <button class="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm" 
                        data-action="export-results">JSON Data</button>
                <button class="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm" 
                        data-action="export-csv">CSV Report</button>
                <button class="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm" 
                        data-action="export-pdf">Text Report</button>
                <div class="border-t border-gray-200 my-1"></div>
                <button class="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-purple-600" 
                        data-action="export-debug-worksheets" 
                        title="Export detailed calculation breakdowns for troubleshooting">
                  🔍 Debug Worksheets
                </button>
              </div>
            </div>
            <button class="text-gray-600 hover:text-gray-800 px-3 py-1 text-sm" 
                    data-action="print-results">Print</button>
          </div>
        </div>

        <div id="results-content">
          <div class="text-center py-8 text-gray-500">
            Add plans and family usage data to see results
          </div>
        </div>
      </div>
    `;
  }

  renderResults() {
    if (!this.results) return;

    // Ensure the main container exists first
    let contentDiv = document.getElementById('results-content');
    if (!contentDiv) {
      console.log('Results content div not found, ensuring container exists...');
      this.render(); // Create the basic structure
      contentDiv = document.getElementById('results-content');
      
      if (!contentDiv) {
        console.error('Could not create results content div');
        return;
      }
    }
    
    contentDiv.innerHTML = `
      <!-- View Navigation -->
      <div class="mb-6 border-b border-gray-200">
        <div class="flex space-x-6">
          <button class="pb-2 ${this.currentView === 'summary' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}" 
                  data-view="summary">Summary</button>
          <button class="pb-2 ${this.currentView === 'detailed' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}" 
                  data-view="detailed">Detailed Breakdown</button>
        </div>
      </div>

      <!-- Content based on current view -->
      ${this.renderCurrentView()}
    `;
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'summary':
        return this.renderSummaryView();
      case 'detailed':
        return this.renderDetailedView();
      default:
        return this.renderSummaryView();
    }
  }

  renderAIInsights() {
    if (!this.llmInsights) {
      return this.llmAssistant.isAvailable() ? 
        `<div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="flex items-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <span class="text-sm text-blue-700">🤖 Generating AI insights for your comparison...</span>
          </div>
        </div>` : '';
    }

    return `
      <div class="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div class="flex items-start">
          <span class="text-2xl mr-4">🤖</span>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-purple-900 mb-3">✨ AI-Powered Insights</h3>
            <div class="prose prose-sm text-gray-700 max-w-none">
              ${this.formatLLMInsights(this.llmInsights)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  formatLLMInsights(insights) {
    // Convert markdown-style formatting to HTML
    return insights
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.+)$/, '<p>$1</p>');
  }

  renderSummaryView() {
    const planIds = Object.keys(this.results);
    const sortedPlans = planIds.sort((a, b) => 
      this.results[a].familyTotals.totalWithPremiums - this.results[b].familyTotals.totalWithPremiums
    );

    return `
      <!-- Best Plan Recommendation -->
      ${this.renderBestPlanRecommendation(sortedPlans[0])}

      <!-- Warning Banner -->
      ${WarningBanner.createResultsWarning()}

      <!-- Cost Comparison Table -->
      <div class="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 class="text-lg font-semibold">Annual Cost Comparison</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full results-table">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-6 text-left font-medium text-gray-900">Plan</th>
                <th class="py-3 px-6 text-left font-medium text-gray-900">Annual Premium</th>
                <th class="py-3 px-6 text-left font-medium text-gray-900">Out-of-Pocket</th>
                <th class="py-3 px-6 text-left font-medium text-gray-900">Total Cost</th>
                <th class="py-3 px-6 text-left font-medium text-gray-900">vs. Best</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${sortedPlans.map(planId => this.renderSummaryRow(this.results[planId])).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Accumulated Costs Chart -->
      <div class="bg-white rounded-lg shadow p-6 mb-8">
        <div style="height: 450px;">
          <canvas id="summary-cost-trend-chart"></canvas>
        </div>
      </div>
    `;
  }

  renderSummaryRow(result) {
    // Safe fallback if comparison data doesn't exist (single plan)
    const hasComparison = result.comparison && typeof result.comparison.isBest !== 'undefined';
    const bestClass = hasComparison && result.comparison.isBest ? 'bg-green-50' : '';
    const savingsDisplay = hasComparison ? 
      (result.comparison.isBest ? 
        '<span class="text-green-600 font-semibold">Best Option</span>' :
        `<span class="text-red-600">+${this.formatCurrency(result.comparison.savingsVsBest)}</span>`) :
      '<span class="text-gray-500">-</span>'; // Single plan fallback

    return `
      <tr class="${bestClass}">
        <td class="py-4 px-6">
          <div class="font-medium">${result.planName}</div>
          <div class="text-sm text-gray-600">${result.insurer}</div>
          ${hasComparison && result.comparison.isBest ? '<div class="text-xs text-green-600 font-semibold">🏆 BEST VALUE</div>' : ''}
        </td>
        <td class="py-4 px-6">${this.formatCurrency(result.annualPremium)}</td>
        <td class="py-4 px-6">${this.formatCurrency(result.familyTotals.totalOutOfPocket)}${WarningBanner.createInlineWarning()}</td>
        <td class="py-4 px-6 font-semibold">${this.formatCurrency(result.familyTotals.totalWithPremiums)}${WarningBanner.createInlineWarning()}</td>
        <td class="py-4 px-6">${savingsDisplay}</td>
      </tr>
    `;
  }

  renderBestPlanRecommendation(bestPlanId) {
    const bestPlan = this.results[bestPlanId];
    
    return `
      <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-green-800">Recommended Plan</h3>
            <p class="text-green-700 mb-3">
              <strong>${bestPlan.planName}</strong> is the most cost-effective option for your family, 
              with an estimated total annual cost of <strong>${this.formatCurrency(bestPlan.familyTotals.totalWithPremiums)}</strong>.
            </p>
            <div class="text-sm text-green-600">
              ${bestPlan.recommendation?.pros?.map(pro => `• ${pro}`).join('<br>') || ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderPlanSummaryCard(result) {
    const recommendationColors = {
      excellent: 'border-green-500 bg-green-50',
      good: 'border-blue-500 bg-blue-50',
      neutral: 'border-gray-300 bg-white',
      poor: 'border-red-300 bg-red-50'
    };

    const cardClass = recommendationColors[result.recommendation?.level] || 'border-gray-300 bg-white';

    return `
      <div class="border-2 ${cardClass} rounded-lg p-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold">${result.planName}</h3>
            <p class="text-gray-600">${result.insurer}</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold">${this.formatCurrency(result.familyTotals.totalWithPremiums)}</div>
            <div class="text-sm text-gray-600">Total Annual Cost</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div class="text-sm text-gray-600">Monthly Premium</div>
            <div class="font-semibold">${this.formatCurrency(result.annualPremium / 12)}</div>
          </div>
          <div>
            <div class="text-sm text-gray-600">Out-of-Pocket</div>
            <div class="font-semibold">${this.formatCurrency(result.familyTotals.totalOutOfPocket)}</div>
          </div>
        </div>

        ${result.recommendation ? `
          <div class="pt-4 border-t border-gray-200">
            <div class="text-sm">
              <div class="font-medium mb-2">${result.recommendation.summary || ''}</div>
              ${result.recommendation.pros?.length > 0 ? `
                <div class="text-green-600 mb-1">
                  ✓ ${result.recommendation.pros.join('<br>✓ ')}
                </div>
              ` : ''}
              ${result.recommendation.cons?.length > 0 ? `
                <div class="text-red-600">
                  ✗ ${result.recommendation.cons.join('<br>✗ ')}
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderDetailedView() {
    const planIds = Object.keys(this.results);
    
    return `
      <div class="space-y-8">
        <!-- Warning Banner -->
        ${WarningBanner.createResultsWarning()}

        <!-- Key Insights Section -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold mb-4">📊 Key Insights</h3>
          <div id="detailed-insights-container" class="space-y-3">
            <!-- Insights will be populated by JavaScript -->
          </div>
        </div>

        <!-- Detailed Plan Breakdowns -->
        ${planIds.map(planId => this.renderDetailedPlanBreakdown(this.results[planId])).join('')}
      </div>
    `;
  }

  renderDetailedPlanBreakdown(result) {
    return `
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 class="text-lg font-semibold">${result.planName} - Detailed Breakdown</h3>
        </div>
        <div class="p-6">
          <!-- Cost Summary -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">${this.formatCurrency(result.annualPremium)}</div>
              <div class="text-sm text-gray-600">Annual Premium</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">${this.formatCurrency(result.familyTotals.medicalCosts)}</div>
              <div class="text-sm text-gray-600">Medical Costs</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-purple-600">${this.formatCurrency(result.familyTotals.rxCosts)}</div>
              <div class="text-sm text-gray-600">Prescription Costs</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900">${this.formatCurrency(result.familyTotals.totalWithPremiums)}</div>
              <div class="text-sm text-gray-600">Total Annual Cost</div>
            </div>
          </div>

          <!-- Timeline and Milestones -->
          ${result.milestones && result.milestones.length > 0 ? `
            <div class="mb-6">
              <h4 class="font-semibold mb-3">Key Milestones</h4>
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="space-y-2">
                  ${result.milestones.map(milestone => `
                    <div class="flex justify-between items-center text-sm">
                      <span class="text-blue-800">${milestone.description}</span>
                      <span class="font-medium text-blue-900">Day ${milestone.day}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Monthly Cost Progression -->
          ${result.monthlyAccumulation && result.monthlyAccumulation.some(m => m.totalCost > 0) ? `
            <div class="mb-6">
              <h4 class="font-semibold mb-3">Monthly Cost Progression</h4>
              <div class="grid grid-cols-12 gap-1">
                ${result.monthlyAccumulation.map((month, index) => `
                  <div class="text-center">
                    <div class="text-xs text-gray-600 mb-1">${month.month || index + 1}</div>
                    <div class="h-16 bg-gradient-to-t from-blue-200 to-blue-100 rounded flex items-end justify-center relative">
                      <div class="h-full w-full bg-blue-500 rounded" 
                           style="height: ${month.totalCost > 0 ? Math.max(8, (month.totalCost / Math.max(...result.monthlyAccumulation.map(m => m.totalCost))) * 100) : 0}%">
                      </div>
                      <span class="absolute bottom-1 text-xs font-medium text-white">
                        ${month.totalCost > 0 ? '$' + Math.round(month.totalCost) : ''}
                      </span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${month.events || 0} events</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Member Breakdown -->
          <div class="space-y-4">
            <h4 class="font-semibold">Family Member Costs</h4>
            ${Object.values(result.memberResults).map(member => this.renderMemberBreakdown(member)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderMemberBreakdown(member) {
    return `
      <div class="border border-gray-200 rounded p-4">
        <div class="flex justify-between items-center mb-3">
          <h5 class="font-medium">${member.memberName}</h5>
          <div class="text-lg font-semibold">${this.formatCurrency(member.totalCosts)}</div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div class="text-gray-600">Medical Services</div>
            <div class="font-medium">${this.formatCurrency(member.medicalCosts)}</div>
          </div>
          <div>
            <div class="text-gray-600">Prescriptions</div>
            <div class="font-medium">${this.formatCurrency(member.rxCosts)}</div>
          </div>
        </div>

        ${member.events && member.events.length > 0 ? `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <div class="text-xs text-gray-600">
              <div class="font-medium mb-2">${member.events.length} Healthcare Events Throughout Year</div>
              <div class="max-h-32 overflow-y-auto space-y-1">
                ${member.events.slice(0, 10).map(event => `
                  <div class="flex justify-between">
                    <span>Day ${event.day}: ${this.formatServiceName(event.serviceType)}</span>
                    <span>${this.formatCurrency(event.memberCost)}</span>
                  </div>
                `).join('')}
                ${member.events.length > 10 ? `
                  <div class="text-center text-gray-500 italic">... and ${member.events.length - 10} more events</div>
                ` : ''}
              </div>
            </div>
          </div>
        ` : Object.keys(member.services || {}).length > 0 ? `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <div class="text-xs text-gray-600 space-y-1">
              ${Object.entries(member.services).map(([serviceType, service]) => `
                <div class="flex justify-between">
                  <span>${this.formatServiceName(serviceType)} (${service.count}x)</span>
                  <span>${this.formatCurrency(service.memberCost)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderScenariosView() {
    const planIds = Object.keys(this.results);
    
    return `
      <div class="space-y-6">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-blue-700">
            <strong>Usage Scenarios:</strong> See how your costs would change with different healthcare usage patterns.
            This helps you understand which plan performs best across various situations.
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full results-table bg-white rounded-lg shadow">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-6 text-left font-medium text-gray-900">Plan</th>
                <th class="py-3 px-6 text-center font-medium text-gray-900">Low Usage</th>
                <th class="py-3 px-6 text-center font-medium text-gray-900">Current Usage</th>
                <th class="py-3 px-6 text-center font-medium text-gray-900">High Usage</th>
                <th class="py-3 px-6 text-center font-medium text-gray-900">Flexibility Score</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${planIds.map(planId => this.renderScenarioRow(this.results[planId])).join('')}
            </tbody>
          </table>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 class="font-semibold text-green-800 mb-2">Low Usage Scenario</h4>
            <p class="text-sm text-green-700">
              Minimal healthcare utilization - basic preventive care and few medical services.
            </p>
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 class="font-semibold text-blue-800 mb-2">Current Usage</h4>
            <p class="text-sm text-blue-700">
              Based on the usage patterns you've entered for your family.
            </p>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 class="font-semibold text-red-800 mb-2">High Usage Scenario</h4>
            <p class="text-sm text-red-700">
              Increased medical needs - more visits, treatments, and medications.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  renderScenarioRow(result) {
    const scenarios = result.scenarios || {};
    const lowCost = scenarios.low?.totalWithPremiums || 0;
    const currentCost = result.familyTotals.totalWithPremiums;
    const highCost = scenarios.high?.totalWithPremiums || 0;
    
    // Calculate flexibility score (lower variance = more predictable)
    const variance = Math.max(highCost - lowCost, 0);
    const avgCost = (lowCost + currentCost + highCost) / 3;
    const flexibilityScore = Math.max(0, 100 - (variance / avgCost) * 100);

    return `
      <tr>
        <td class="py-4 px-6">
          <div class="font-medium">${result.planName}</div>
          <div class="text-sm text-gray-600">${result.insurer}</div>
        </td>
        <td class="py-4 px-6 text-center">${this.formatCurrency(lowCost)}</td>
        <td class="py-4 px-6 text-center font-semibold">${this.formatCurrency(currentCost)}</td>
        <td class="py-4 px-6 text-center">${this.formatCurrency(highCost)}</td>
        <td class="py-4 px-6 text-center">
          <div class="flex items-center justify-center">
            <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
              <div class="bg-blue-500 h-2 rounded-full" style="width: ${flexibilityScore}%"></div>
            </div>
            <span class="text-sm">${Math.round(flexibilityScore)}%</span>
          </div>
        </td>
      </tr>
    `;
  }

  formatServiceName(serviceType) {
    const names = {
      primaryVisits: 'Primary Care',
      specialistVisits: 'Specialist',
      therapyVisits: 'Therapy',
      labWork: 'Lab Work',
      imaging: 'Imaging',
      physicalTherapy: 'Physical Therapy'
    };
    
    return names[serviceType] || serviceType;
  }

  exportResults() {
    if (!this.results) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: this.generateTextSummary(),
      results: this.results
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-plan-comparison-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printResults() {
    if (!this.results) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Health Plan Comparison Results</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .summary { background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>Health Plan Comparison Results</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <div class="summary">
            ${this.generateTextSummary()}
          </div>
          ${this.generatePrintableTable()}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  shareResults() {
    if (!this.results) return;
    
    const summary = this.generateTextSummary();
    
    if (navigator.share) {
      navigator.share({
        title: 'Health Plan Comparison Results',
        text: summary,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(summary).then(() => {
        alert('Results copied to clipboard!');
      });
    }
  }

  generateTextSummary() {
    if (!this.results) return '';
    
    const planIds = Object.keys(this.results);
    const sortedPlans = planIds.sort((a, b) => 
      this.results[a].familyTotals.totalWithPremiums - this.results[b].familyTotals.totalWithPremiums
    );
    
    const bestPlan = this.results[sortedPlans[0]];
    
    return `
      Health Plan Comparison Summary
      
      Recommended Plan: ${bestPlan.planName}
      Total Annual Cost: ${this.formatCurrency(bestPlan.familyTotals.totalWithPremiums)}
      
      All Plans Compared:
      ${sortedPlans.map((planId, index) => {
        const plan = this.results[planId];
        return `${index + 1}. ${plan.planName}: ${this.formatCurrency(plan.familyTotals.totalWithPremiums)}`;
      }).join('\n')}
    `;
  }

  generatePrintableTable() {
    const planIds = Object.keys(this.results);
    const sortedPlans = planIds.sort((a, b) => 
      this.results[a].familyTotals.totalWithPremiums - this.results[b].familyTotals.totalWithPremiums
    );
    
    return `
      <table>
        <thead>
          <tr>
            <th>Plan Name</th>
            <th>Annual Premium</th>
            <th>Out-of-Pocket</th>
            <th>Total Cost</th>
          </tr>
        </thead>
        <tbody>
          ${sortedPlans.map(planId => {
            const plan = this.results[planId];
            return `
              <tr>
                <td>${plan.planName}</td>
                <td>${this.formatCurrency(plan.annualPremium)}</td>
                <td>${this.formatCurrency(plan.familyTotals.totalOutOfPocket)}</td>
                <td><strong>${this.formatCurrency(plan.familyTotals.totalWithPremiums)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  renderChartsView() {
    return `
      <div class="space-y-6">
        <!-- Charts Grid -->
        ${ChartManager.generateChartContainers()}
        
        <!-- Insights Panel -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold mb-4">📊 Key Insights</h3>
          <div id="insights-container" class="space-y-3">
            <!-- Insights will be populated by JavaScript -->
          </div>
        </div>
      </div>
    `;
  }

  initializeCharts() {
    if (!this.results) return;

    // Create all charts, passing calculator for progression data access
    this.chartManager.createCostComparisonChart('cost-comparison-chart', this.results);
    this.chartManager.createPieChart('cost-distribution-chart', this.results);
    this.chartManager.createScenarioComparisonChart('scenario-comparison-chart', this.results);
    this.chartManager.createCostTrendChart('cost-trend-chart', this.results, this.calculator);

    // Generate and display insights
    this.displayInsights();
  }

  displayInsights() {
    const insightsContainer = document.getElementById('insights-container');
    if (!insightsContainer || !this.results) return;

    // Get family data from storage or emit request
    this.emit('requestFamilyData', (familyData) => {
      const insights = DataManager.generateInsights(this.results, familyData);
      
      insightsContainer.innerHTML = insights.map(insight => `
        <div class="border-l-4 ${this.getInsightBorderColor(insight.type)} bg-gray-50 p-4 rounded-r">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              ${this.getInsightIcon(insight.type)}
            </div>
            <div class="ml-3">
              <h4 class="font-medium text-gray-900">${insight.title}</h4>
              <p class="text-gray-700 text-sm mt-1">${insight.message}</p>
            </div>
          </div>
        </div>
      `).join('');
    });
  }

  getInsightBorderColor(type) {
    const colors = {
      warning: 'border-yellow-400',
      info: 'border-blue-400',
      tip: 'border-green-400',
      error: 'border-red-400'
    };
    return colors[type] || 'border-gray-400';
  }

  getInsightIcon(type) {
    const icons = {
      warning: '⚠️',
      info: 'ℹ️',
      tip: '💡',
      error: '🚨'
    };
    return icons[type] || '📝';
  }

  exportCSV() {
    if (!this.results) return;
    
    try {
      const csvContent = DataManager.generateCSVReport(this.results);
      const filename = `health-plan-comparison-${new Date().toISOString().split('T')[0]}.csv`;
      DataManager.downloadFile(csvContent, filename, 'text/csv');
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('Failed to export CSV report');
    }
  }

  exportPDF() {
    if (!this.results) return;
    
    try {
      // Get family data for PDF report
      this.emit('requestFamilyData', (familyData) => {
        const pdfContent = DataManager.generatePDFReport(this.results, familyData);
        const filename = `health-plan-comparison-${new Date().toISOString().split('T')[0]}.txt`;
        DataManager.downloadFile(pdfContent, filename, 'text/plain');
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF report');
    }
  }


  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }
}
