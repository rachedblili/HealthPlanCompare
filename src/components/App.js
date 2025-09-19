// Main Application Component
import { PlanManager } from './PlanManager.js';
import { FamilyManager } from './FamilyManager.js';
import { ServiceCostManager } from './ServiceCostManager.js';
import { ResultsManager } from './ResultsManager.js';
import { DisclaimerModal } from './DisclaimerModal.js';
import { WarningBanner } from './WarningBanner.js';
import { CostCalculator } from '../utils/CostCalculator.js';
import { EventEmitter } from '../utils/EventEmitter.js';
import { DataManager } from '../utils/DataManager.js';

export class App extends EventEmitter {
  constructor() {
    super();
    this.planManager = null;
    this.familyManager = null;
    this.serviceCostManager = null;
    this.resultsManager = null;
    this.calculator = new CostCalculator();
    this.currentTab = 'plans';
    this.isCalculating = false;
    this.calculationCount = 0;
    this.isInitializing = true;
    
    this.setupEventListeners();
  }

  async init() {
    // Show disclaimer modal first
    const disclaimerModal = new DisclaimerModal();
    const accepted = await disclaimerModal.show();
    
    if (!accepted) {
      // User declined, show a message and stop initialization
      document.getElementById('app').innerHTML = `
        <div class="flex items-center justify-center min-h-screen bg-gray-50">
          <div class="text-center p-8">
            <h1 class="text-2xl font-bold text-gray-900 mb-4">Health Plan Comparison Tool</h1>
            <p class="text-gray-600 mb-4">You must accept the terms to use this tool.</p>
            <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Try Again
            </button>
          </div>
        </div>
      `;
      return;
    }
    
    this.render();
    await this.initializeComponents();
    this.setupTabNavigation();
    this.setupAppEventListeners();
  }

  async initializeComponents() {
    console.log('Initializing components...');
    
    // Log configuration
    try {
      console.log('App components initialized');
    } catch (error) {
      console.log('Could not load configuration:', error.message);
    }
    
    // Initialize managers
    this.planManager = new PlanManager();
    this.familyManager = new FamilyManager();
    this.serviceCostManager = new ServiceCostManager();
    this.resultsManager = new ResultsManager();

    // Initialize each component with error handling BEFORE setting up events
    try {
      console.log('Initializing PlanManager...');
      await this.planManager.init();
      
      console.log('Initializing FamilyManager...');
      await this.familyManager.init();
      
      console.log('Initializing ServiceCostManager...');
      await this.serviceCostManager.init();
      
      console.log('Initializing ResultsManager...');
      await this.resultsManager.init();
      
      // Pass calculator instance to ResultsManager for chart progression data access
      this.resultsManager.setCalculator(this.calculator);
      
      console.log('All components initialized');
      
      // NOW setup cross-component communication with debouncing
      let recalculateTimeout;
      const debouncedRecalculate = () => {
        if (this.isInitializing) {
          console.log('Ignoring recalculation during initialization');
          return;
        }
        clearTimeout(recalculateTimeout);
        recalculateTimeout = setTimeout(() => this.recalculate(), 100);
      };
      
      this.planManager.on('plansChanged', () => {
        console.log('Plans changed, scheduling recalculation');
        debouncedRecalculate();
      });
      
      this.familyManager.on('familyChanged', () => {
        console.log('Family changed, scheduling recalculation');
        debouncedRecalculate();
      });
      
      this.serviceCostManager.on('serviceCostsChanged', () => {
        console.log('Service costs changed, scheduling recalculation');
        debouncedRecalculate();
      });
      
      this.resultsManager.on('requestFamilyData', (callback) => {
        callback(this.familyManager.getFamilyData());
      });
      
      this.resultsManager.on('requestPlanData', (callback) => {
        callback(this.planManager.getPlans());
      });
      
      // Mark initialization complete
      this.isInitializing = false;
      console.log('Initialization complete, events enabled');
      
      // Initial calculation after small delay
      setTimeout(() => this.recalculate(), 200);
      
    } catch (error) {
      console.error('Component initialization failed:', error);
      throw error;
    }
  }

  setupEventListeners() {
    // Handle plan updates
    this.on('recalculate', () => this.recalculate());
  }

  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update active states
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
        
        this.currentTab = targetTab;
        this.emit('tabChanged', targetTab);
      });
    });
  }

  async recalculate() {
    // Prevent infinite loops and excessive calculations
    if (this.isCalculating) {
      console.warn('⏸ Calculation already in progress, skipping');
      return;
    }
    
    this.calculationCount++;
    if (this.calculationCount > 50) {
      console.error('❌ Too many calculations, possible infinite loop detected');
      return;
    }
    
    if (!this.planManager || !this.familyManager || !this.serviceCostManager || !this.resultsManager) {
      console.log('⏸ Components not ready for calculation');
      return;
    }

    this.isCalculating = true;
    
    try {
      console.log(`📋 Recalculating (${this.calculationCount})...`);
      
      const plans = this.planManager.getPlans();
      const familyData = this.familyManager.getFamilyData();
      const serviceCosts = this.serviceCostManager.getServiceCosts();
      
      // Merge service costs into family data
      const familyDataWithCosts = {
        ...familyData,
        ...serviceCosts
      };
      
      console.log(`📄 Got ${plans.length} plans, ${familyData.members.length} family members`);
      
      if (plans.length === 0) {
        console.log(`ℹ No plans to calculate, showing no-plans message`);
        this.resultsManager.showNoPlansMessage();
        return;
      }

      console.log(`📋 Starting calculation with CostCalculator...`);
      const results = await this.calculator.calculateAll(plans, familyDataWithCosts);
      console.log(`✅ Calculation complete`);
      
      this.resultsManager.displayResults(results);
    
    // Pass calculator to results manager for debug export
    this.resultsManager.setCalculator(this.calculator);
      console.log(`✅ Results displayed successfully`);
      
      this.emit('calculationComplete', results);
    } catch (error) {
      console.error('❌ Calculation error:', error);
      console.error('❌ Error stack:', error.stack);
      this.resultsManager.showError('Calculation failed. Please check your inputs.');
    } finally {
      this.isCalculating = false;
      console.log(`🔄 isCalculating set to false`);
    }
  }

  setupAppEventListeners() {
    const app = document.getElementById('app');
    
    app.addEventListener('click', async (e) => {
      if (e.target.matches('[data-action="import-config"]')) {
        await this.showImportDialog();
      }
      
      if (e.target.matches('[data-action="export-config"]')) {
        await this.exportConfiguration();
      }
      
    });
  }

  async showImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const content = await DataManager.readFile(file);
          const data = JSON.parse(content);
          const imported = await DataManager.importConfiguration(data);
          
          // Update components with imported data
          if (imported.plans) {
            this.planManager.importPlans(imported.plans);
          }
          if (imported.familyData) {
            this.familyManager.importFamilyData(imported.familyData);
            // Also import service costs if they exist in family data
            if (imported.familyData.serviceCosts || imported.familyData.costArea) {
              this.serviceCostManager.importServiceCosts(imported.familyData);
            }
          }
          
          alert('Configuration imported successfully!');
          this.recalculate();
        } catch (error) {
          console.error('Import failed:', error);
          alert('Failed to import configuration: ' + error.message);
        }
      }
    };
    input.click();
  }

  async exportConfiguration() {
    try {
      const plans = this.planManager.getPlans();
      const familyData = this.familyManager.getFamilyData();
      
      // Sanitize data to prevent circular references and browser crashes
      const sanitizedPlans = this.sanitizeForExport(plans);
      const sanitizedFamilyData = this.sanitizeForExport(familyData);
      
      const exportData = await DataManager.exportConfiguration(sanitizedPlans, sanitizedFamilyData);
      
      const filename = `health-plan-config-${new Date().toISOString().split('T')[0]}.json`;
      DataManager.downloadFile(exportData, filename);
      
      console.log('✅ Configuration exported successfully');
      alert('Configuration exported successfully! Check your downloads folder.');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export configuration: ' + error.message);
    }
  }

  sanitizeForExport(data) {
    try {
      // Use JSON parse/stringify to break circular references and remove problematic objects
      return JSON.parse(JSON.stringify(data, (key, value) => {
        // Skip functions, DOM elements, event listeners, and other problematic types
        if (typeof value === 'function' || 
            value instanceof HTMLElement || 
            value instanceof Event ||
            value instanceof Node ||
            (value && typeof value === 'object' && value.constructor && value.constructor.name === 'EventEmitter')) {
          return undefined;
        }
        return value;
      }));
    } catch (error) {
      console.error('Data sanitization failed:', error);
      throw new Error('Unable to serialize data - contains circular references or unsupported types');
    }
  }


  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="container mx-auto px-4 py-8 max-w-7xl">
        <!-- Header -->
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gray-900 mb-2">Health Plan Comparison Tool</h1>
          <p class="text-lg text-gray-600 mb-4">Compare health insurance plans based on your family's actual usage</p>
          
          <!-- Quick Actions -->
          <div class="flex justify-center space-x-4 text-sm">
            <button class="text-blue-600 hover:text-blue-800 underline" data-action="import-config">
              📥 Import Configuration
            </button>
            <button class="text-blue-600 hover:text-blue-800 underline" data-action="export-config">
              📤 Export Configuration
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="mb-6 border-b border-gray-200">
          <div class="flex flex-wrap">
            <button class="tab-btn active py-3 px-6 mr-2 font-medium focus:outline-none" data-tab="plans">
              📋 Your Plans
            </button>
            <button class="tab-btn py-3 px-6 mr-2 font-medium focus:outline-none" data-tab="family">
              👥 Family Usage
            </button>
            <button class="tab-btn py-3 px-6 mr-2 font-medium focus:outline-none" data-tab="costs">
              💰 Service Costs
            </button>
            <button class="tab-btn py-3 px-6 mr-2 font-medium focus:outline-none" data-tab="results">
              📊 Comparison Results
            </button>
          </div>
        </div>

        <!-- Tab Contents -->
        <div id="plans-tab" class="tab-content active">
          <div id="plan-manager-container"></div>
        </div>

        <div id="family-tab" class="tab-content">
          <div id="family-manager-container"></div>
        </div>

        <div id="costs-tab" class="tab-content">
          <div id="service-cost-manager-container"></div>
        </div>

        <div id="results-tab" class="tab-content">
          <div id="results-container"></div>
        </div>

        <!-- Footer -->
        <div class="mt-12 text-center text-gray-500 text-sm">
          <p>Health Plan Comparison Tool - Free & Open Source</p>
          <p class="mt-1">Data is processed locally in your browser for privacy</p>
        </div>
        
        ${WarningBanner.createFooterDisclaimer()}
      </div>
    `;
  }
}
