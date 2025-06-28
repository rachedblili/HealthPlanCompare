// Service Cost Manager Component - Handles healthcare service cost assumptions
import { EventEmitter } from '../utils/EventEmitter.js';
import { StorageManager } from '../utils/StorageManager.js';
import { WarningBanner } from './WarningBanner.js';

export class ServiceCostManager extends EventEmitter {
  constructor() {
    super();
    this.costArea = 'medium'; // Track cost of living area
    this.serviceCosts = this.getDefaultServiceCosts();
    this.saveTimeout = null;
    this.isInitialized = false;
  }

  async init() {
    // Load saved service cost data
    const savedData = StorageManager.loadFamilyData();
    if (savedData) {
      if (savedData.costArea) {
        this.costArea = savedData.costArea;
        // Update service costs based on saved cost area
        this.serviceCosts = this.getServiceCostsByArea(this.costArea);
      }
      if (savedData.serviceCosts) {
        // Override with any custom service costs
        this.serviceCosts = { ...this.serviceCosts, ...savedData.serviceCosts };
      }
    }
    
    this.render();
    this.setupEventListeners();
    this.isInitialized = true;
    console.log('ServiceCostManager initialized');
  }

  getDefaultServiceCosts() {
    // Default to medium cost area (national average)
    return this.getServiceCostsByArea('medium');
  }

  getServiceCostsByArea(costArea) {
    const baseCosts = {
      primaryVisit: 150,
      specialistVisit: 250,
      therapySession: 120,
      labWork: 200,
      basicImaging: 400,
      advancedImaging: 1500,
      physicalTherapy: 115,
      emergencyRoom: 1800,
      urgentCare: 225
    };

    const multipliers = {
      'low': 0.75,     // Rural/low cost areas (Texas, Florida rural, Midwest)
      'medium': 1.0,   // National average
      'high': 1.35     // High cost metros (NYC, SF Bay, LA, Boston, Seattle)
    };

    const multiplier = multipliers[costArea] || 1.0;
    
    return Object.fromEntries(
      Object.entries(baseCosts).map(([key, value]) => [
        key, 
        Math.round(value * multiplier)
      ])
    );
  }

  setupEventListeners() {
    const container = document.getElementById('service-cost-manager-container');
    
    container.addEventListener('change', (e) => {
      // Service cost changes
      if (e.target.matches('.cost-input')) {
        this.handleCostChange(e.target);
      }
      
      // Cost area changes
      if (e.target.matches('[data-field="costArea"]')) {
        this.handleCostAreaChange(e.target);
      }
    });
  }

  handleCostChange(input) {
    const field = input.dataset.field;
    const value = parseFloat(input.value) || 0;
    
    if (field && this.serviceCosts.hasOwnProperty(field)) {
      this.serviceCosts[field] = value;
      this.debouncedSave();
      this.emit('serviceCostsChanged', this.getServiceCosts());
    }
  }

  handleCostAreaChange(select) {
    const newCostArea = select.value;
    this.costArea = newCostArea;
    
    // Update service costs to reflect the new cost area
    this.serviceCosts = this.getServiceCostsByArea(newCostArea);
    
    this.debouncedSave();
    this.render();
    this.emit('serviceCostsChanged', this.getServiceCosts());
  }

  getServiceCosts() {
    return {
      serviceCosts: this.serviceCosts,
      costArea: this.costArea
    };
  }

  importServiceCosts(data) {
    if (data.serviceCosts) {
      this.serviceCosts = { ...data.serviceCosts };
    }
    if (data.costArea) {
      this.costArea = data.costArea;
    }
    this.debouncedSave();
    this.render();
    this.emit('serviceCostsChanged', this.getServiceCosts());
  }

  saveServiceCosts() {
    try {
      // Get existing family data and update it with service costs
      const existingData = StorageManager.loadFamilyData() || {};
      const updatedData = {
        ...existingData,
        serviceCosts: this.serviceCosts,
        costArea: this.costArea
      };
      StorageManager.saveFamilyData(updatedData);
    } catch (error) {
      console.warn('Failed to save service costs to localStorage:', error);
    }
  }
  
  debouncedSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveServiceCosts();
    }, 500); // 500ms debounce for data entry
  }

  render() {
    const container = document.getElementById('service-cost-manager-container');
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-semibold">Healthcare Service Cost Assumptions</h2>
        </div>

        ${WarningBanner.createCostAssumptionsWarning()}
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-blue-700">
            <strong>Cost Assumptions:</strong> These pricing assumptions are used to calculate your estimated out-of-pocket costs. 
            They reflect typical 2025 healthcare service prices and are automatically adjusted based on your cost of living area.
            <br><br>
            <strong>Customization:</strong> You can adjust individual service costs below if you know specific prices in your area 
            or have negotiated rates with providers.
          </p>
        </div>

        ${this.renderServiceCosts()}
      </div>
    `;
  }

  renderServiceCosts() {
    return `
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">Service Cost Settings</h3>
        
        <!-- Cost of Living Area Selector -->
        <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="mb-3">
            <label class="block text-sm font-medium text-blue-900 mb-2">Cost of Living Area</label>
            <select id="cost-area-selector" class="w-full border border-blue-300 rounded px-3 py-2 bg-white" data-field="costArea">
              <option value="low" ${this.costArea === 'low' ? 'selected' : ''}>Low Cost Areas (Rural, Midwest)</option>
              <option value="medium" ${this.costArea === 'medium' ? 'selected' : ''}>Average Cost Areas (National Average)</option>
              <option value="high" ${this.costArea === 'high' ? 'selected' : ''}>High Cost Areas (NYC, SF, LA, Boston)</option>
            </select>
          </div>
          <div class="text-xs text-blue-700">
            <strong>Guidance:</strong> 
            • Choose "High Cost" if you live in major metropolitan areas like New York City, San Francisco Bay Area, Los Angeles, Boston, or Seattle
            • Choose "Low Cost" if you live in rural areas or smaller cities in states like Texas, Florida, Ohio, or the Midwest
            • Choose "Average Cost" for most suburban areas and mid-sized cities
          </div>
        </div>
        
        <p class="text-sm text-gray-600 mb-4">
          These costs are automatically adjusted based on your selected cost area. You can further customize individual prices below.
        </p>
        
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          ${Object.entries(this.serviceCosts).map(([key, value]) => `
            <div>
              <label class="block text-sm font-medium mb-1">${this.formatServiceName(key)} ($)</label>
              <input type="number" min="0" step="0.01" value="${value}"
                     class="cost-input w-full border border-gray-300 rounded px-3 py-2"
                     data-field="${key}">
            </div>
          `).join('')}
        </div>

        <div class="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Cost Area Comparison</h4>
          <div class="text-xs text-gray-600 space-y-1">
            <div><strong>Low Cost Areas:</strong> 25% below national average (rural areas, smaller cities)</div>
            <div><strong>Average Cost Areas:</strong> National average pricing (most suburban areas)</div>
            <div><strong>High Cost Areas:</strong> 35% above national average (major metropolitan areas)</div>
          </div>
        </div>
      </div>
    `;
  }

  formatServiceName(key) {
    const names = {
      primaryVisit: 'Primary Care Visit',
      specialistVisit: 'Specialist Visit',
      therapySession: 'Therapy Session',
      labWork: 'Lab Work',
      basicImaging: 'Basic Imaging',
      advancedImaging: 'Advanced Imaging',
      physicalTherapy: 'Physical Therapy',
      emergencyRoom: 'Emergency Room',
      urgentCare: 'Urgent Care'
    };
    
    return names[key] || key;
  }
}