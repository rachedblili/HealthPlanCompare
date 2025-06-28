// Family Manager Component - Handles family usage data input and management
import { EventEmitter } from '../utils/EventEmitter.js';
import { StorageManager } from '../utils/StorageManager.js';
import { WarningBanner } from './WarningBanner.js';

export class FamilyManager extends EventEmitter {
  constructor() {
    super();
    this.familyData = this.getDefaultFamilyData();
    this.currentScenario = 'medium'; // Track current usage scenario
    this.saveTimeout = null;
    this.renderTimeout = null;
    this.emitTimeout = null;
    this.isInitialized = false;
  }

  async init() {
    // Load saved family data
    const savedData = StorageManager.loadFamilyData();
    if (savedData) {
      this.familyData = { ...this.familyData, ...savedData };
      if (savedData.currentScenario) {
        this.currentScenario = savedData.currentScenario;
      }
    }
    
    this.render();
    this.setupEventListeners();
    this.isInitialized = true;
    console.log('FamilyManager initialized');
  }

  getDefaultFamilyData() {
    return {
      members: [
        {
          id: 'member_1',
          name: 'You',
          relationship: 'self',
          age: 35,
          primaryVisits: 2,
          specialistVisits: 1,
          therapyVisits: 0,
          labWork: 1,
          imaging: 0,
          physicalTherapy: 0,
          medications: [],
          isActive: true
        },
        {
          id: 'member_2',
          name: 'Spouse',
          relationship: 'spouse',
          age: 33,
          primaryVisits: 2,
          specialistVisits: 1,
          therapyVisits: 0,
          labWork: 1,
          imaging: 0,
          physicalTherapy: 0,
          medications: [],
          isActive: false
        },
        {
          id: 'member_3',
          name: 'Child 1',
          relationship: 'child',
          age: 8,
          primaryVisits: 3,
          specialistVisits: 0,
          therapyVisits: 0,
          labWork: 0,
          imaging: 0,
          physicalTherapy: 0,
          medications: [],
          isActive: false
        },
        {
          id: 'member_4',
          name: 'Child 2',
          relationship: 'child',
          age: 5,
          primaryVisits: 3,
          specialistVisits: 0,
          therapyVisits: 0,
          labWork: 0,
          imaging: 0,
          physicalTherapy: 0,
          medications: [],
          isActive: false
        }
      ]
    };
  }


  setupEventListeners() {
    const container = document.getElementById('family-manager-container');
    
    // Member toggle
    container.addEventListener('change', (e) => {
      if (e.target.matches('.member-toggle')) {
        const memberId = e.target.dataset.memberId;
        this.toggleMember(memberId, e.target.checked);
      }
      
      // Usage input changes
      if (e.target.matches('.usage-input')) {
        this.handleUsageChange(e.target);
      }
      
    });

    // Add/remove medication buttons
    container.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="add-medication"]')) {
        const memberId = e.target.dataset.memberId;
        this.addMedication(memberId);
      }
      
      if (e.target.matches('[data-action="remove-medication"]')) {
        const memberId = e.target.dataset.memberId;
        const medIndex = parseInt(e.target.dataset.medIndex);
        this.removeMedication(memberId, medIndex);
      }
      
      if (e.target.matches('[data-action="add-member"]')) {
        this.addCustomMember();
      }
      
      if (e.target.matches('[data-action="remove-member"]')) {
        const memberId = e.target.dataset.memberId;
        this.removeCustomMember(memberId);
      }
    });

    // Usage scenario buttons
    container.addEventListener('click', (e) => {
      if (e.target.matches('[data-scenario]')) {
        const scenario = e.target.dataset.scenario;
        this.applyUsageScenario(scenario);
      }
    });
  }

  toggleMember(memberId, isActive) {
    const member = this.familyData.members.find(m => m.id === memberId);
    if (member) {
      member.isActive = isActive;
      this.debouncedSave();
      this.debouncedRender();
      this.debouncedEmit();
    }
  }

  handleUsageChange(input) {
    const memberId = input.dataset.memberId;
    const field = input.dataset.field;
    const value = input.type === 'number' ? 
      (input.step === '0.01' ? parseFloat(input.value) || 0 : parseInt(input.value) || 0) : 
      input.value;
    
    const member = this.familyData.members.find(m => m.id === memberId);
    if (member && field) {
      // Handle medication fields like "medications[0].name"
      if (field.startsWith('medications[')) {
        const match = field.match(/medications\[(\d+)\]\.(.+)/);
        if (match) {
          const medIndex = parseInt(match[1]);
          const medField = match[2];
          if (member.medications[medIndex]) {
            if (medField === 'tier') {
              member.medications[medIndex][medField] = parseInt(value);
            } else if (medField === 'monthlyCost') {
              member.medications[medIndex][medField] = parseFloat(value) || 0;
            } else {
              member.medications[medIndex][medField] = value;
            }
          }
        }
      } else {
        // Handle regular member fields
        member[field] = value;
      }
      this.debouncedSave();
      this.debouncedEmit();
    }
  }


  addMedication(memberId) {
    const member = this.familyData.members.find(m => m.id === memberId);
    if (member) {
      member.medications.push({
        id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: '',
        tier: 1,
        monthlyCost: 0,
        quantity: 1
      });
      this.debouncedSave();
      this.debouncedRender();
      this.debouncedEmit();
    }
  }

  removeMedication(memberId, medIndex) {
    const member = this.familyData.members.find(m => m.id === memberId);
    if (member && member.medications[medIndex]) {
      member.medications.splice(medIndex, 1);
      this.debouncedSave();
      this.debouncedRender();
      this.debouncedEmit();
    }
  }

  addCustomMember() {
    const memberCount = this.familyData.members.length;
    const newMember = {
      id: `member_${memberCount + 1}`,
      name: `Family Member ${memberCount + 1}`,
      relationship: 'other',
      age: 25,
      primaryVisits: 1,
      specialistVisits: 0,
      therapyVisits: 0,
      labWork: 0,
      imaging: 0,
      physicalTherapy: 0,
      medications: [],
      isActive: true,
      isCustom: true
    };
    
    this.familyData.members.push(newMember);
    this.debouncedSave();
    this.debouncedRender();
    this.debouncedEmit();
  }

  removeCustomMember(memberId) {
    if (confirm('Are you sure you want to remove this family member?')) {
      this.familyData.members = this.familyData.members.filter(m => m.id !== memberId);
      this.debouncedSave();
      this.debouncedRender();
      this.debouncedEmit();
    }
  }

  applyUsageScenario(scenario) {
    this.currentScenario = scenario; // Track the selected scenario
    switch (scenario) {
      case 'low':
        this.applyLowUsageScenario();
        break;
      case 'medium':
        this.applyMediumUsageScenario();
        break;
      case 'high':
        this.applyHighUsageScenario();
        break;
    }
    
    this.debouncedSave();
    this.debouncedRender();
    this.debouncedEmit();
  }

  applyLowUsageScenario() {
    this.familyData.members.forEach(member => {
      if (member.isActive) {
        member.primaryVisits = member.relationship === 'child' ? 2 : 1;
        member.specialistVisits = 0;
        member.therapyVisits = 0;
        member.labWork = 0;
        member.imaging = 0;
        member.physicalTherapy = 0;
        member.medications = [];
      }
    });
  }

  applyMediumUsageScenario() {
    this.familyData.members.forEach(member => {
      if (member.isActive) {
        member.primaryVisits = member.relationship === 'child' ? 3 : 2;
        member.specialistVisits = 1;
        member.therapyVisits = 0;
        member.labWork = 1;
        member.imaging = member.relationship === 'self' || member.relationship === 'spouse' ? 1 : 0;
        member.physicalTherapy = 0;
        member.medications = member.age > 30 ? [{
          id: `med_${Date.now()}`,
          name: 'Generic medication',
          tier: 1,
          monthlyCost: 15,
          quantity: 1
        }] : [];
      }
    });
  }

  applyHighUsageScenario() {
    this.familyData.members.forEach(member => {
      if (member.isActive) {
        member.primaryVisits = member.relationship === 'child' ? 4 : 6;
        member.specialistVisits = member.relationship === 'child' ? 1 : 3;
        member.therapyVisits = member.age > 12 ? 26 : 0; // Every 2 weeks
        member.labWork = member.relationship === 'child' ? 1 : 3;
        member.imaging = member.age > 18 ? 2 : 0;
        member.physicalTherapy = member.age > 25 ? 12 : 0;
        
        // Add multiple medications for high usage
        member.medications = [];
        if (member.age > 18) {
          member.medications.push({
            id: `med_${Date.now()}_1`,
            name: 'Generic medication',
            tier: 1,
            monthlyCost: 15,
            quantity: 1
          });
        }
        if (member.age > 30) {
          member.medications.push({
            id: `med_${Date.now()}_2`,
            name: 'Brand medication',
            tier: 2,
            monthlyCost: 50,
            quantity: 1
          });
        }
      }
    });
  }

  getFamilyData() {
    return {
      members: this.familyData.members.filter(m => m.isActive)
    };
  }

  importFamilyData(data) {
    if (data.members) {
      this.familyData.members = data.members.map(member => ({ ...member }));
    }
    this.debouncedSave();
    this.debouncedRender();
    this.debouncedEmit();
  }

  saveFamilyData() {
    try {
      const existingData = StorageManager.loadFamilyData() || {};
      StorageManager.saveFamilyData({
        ...existingData,
        members: this.familyData.members,
        currentScenario: this.currentScenario
      });
    } catch (error) {
      console.warn('Failed to save family data to localStorage:', error);
    }
  }
  
  debouncedSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveFamilyData();
    }, 500); // 500ms debounce for data entry
  }
  
  debouncedRender() {
    clearTimeout(this.renderTimeout);
    this.renderTimeout = setTimeout(() => {
      this.render();
    }, 100); // 100ms debounce for rendering
  }
  
  debouncedEmit() {
    clearTimeout(this.emitTimeout);
    this.emitTimeout = setTimeout(() => {
      if (this.isInitialized) {
        this.emit('familyChanged', this.familyData);
      }
    }, 750); // 750ms debounce for app recalculation
  }

  render() {
    const container = document.getElementById('family-manager-container');
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-semibold">Family Healthcare Usage</h2>
          <div class="flex space-x-2">
            <button class="text-sm px-3 py-1 rounded ${this.currentScenario === 'low' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}" 
                    data-scenario="low">Low Usage</button>
            <button class="text-sm px-3 py-1 rounded ${this.currentScenario === 'medium' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}" 
                    data-scenario="medium">Medium Usage</button>
            <button class="text-sm px-3 py-1 rounded ${this.currentScenario === 'high' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}" 
                    data-scenario="high">High Usage</button>
          </div>
        </div>

        <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-2 text-sm">
              <p class="text-orange-800 font-medium">Plan for realistic healthcare usage</p>
              <p class="text-orange-700 mt-1">Consider your family's actual medical history and anticipated needs. These estimates directly impact plan comparisons, so accuracy improves decision-making.</p>
            </div>
          </div>
        </div>

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-blue-700">
            <strong>Quick Start:</strong> Use the scenario buttons above to set typical usage patterns, 
            then customize individual family members as needed. Only active members will be included in calculations.
            <br><br>
            <strong>Time Periods:</strong> All healthcare visits and services are entered as <em>annual totals</em> (per year). 
            Medication costs are <em>monthly</em>.
          </p>
        </div>

        <!-- Family Members -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          ${this.familyData.members.map(member => this.renderMemberCard(member)).join('')}
        </div>

        <div class="flex justify-center">
          <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
                  data-action="add-member">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Add Family Member
          </button>
        </div>

      </div>
    `;
  }

  renderMemberCard(member) {
    return `
      <div class="bg-white rounded-lg shadow p-6 ${member.isActive ? 'ring-2 ring-blue-500' : 'opacity-75'}">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <label class="flex items-center">
              <input type="checkbox" class="member-toggle mr-3" 
                     data-member-id="${member.id}" ${member.isActive ? 'checked' : ''}>
              <div>
                <input type="text" value="${member.name}" 
                       class="usage-input font-medium text-lg border-none p-0 focus:ring-0" 
                       data-member-id="${member.id}" data-field="name"
                       ${!member.isActive ? 'disabled' : ''}>
                <div class="text-sm text-gray-600">
                  <select class="usage-input border-none p-0 text-sm" 
                          data-member-id="${member.id}" data-field="relationship"
                          ${!member.isActive ? 'disabled' : ''}>
                    <option value="self" ${member.relationship === 'self' ? 'selected' : ''}>Self</option>
                    <option value="spouse" ${member.relationship === 'spouse' ? 'selected' : ''}>Spouse</option>
                    <option value="child" ${member.relationship === 'child' ? 'selected' : ''}>Child</option>
                    <option value="other" ${member.relationship === 'other' ? 'selected' : ''}>Other</option>
                  </select>
                  • Age: 
                  <input type="number" value="${member.age}" min="0" max="120"
                         class="usage-input w-12 border-none p-0 text-sm" 
                         data-member-id="${member.id}" data-field="age"
                         ${!member.isActive ? 'disabled' : ''}>
                </div>
              </div>
            </label>
          </div>
          ${member.isCustom ? `
            <button class="text-red-400 hover:text-red-600" 
                    data-action="remove-member" data-member-id="${member.id}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          ` : ''}
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium mb-1">Primary Care Visits (per year)</label>
            <input type="number" min="0" value="${member.primaryVisits}"
                   class="usage-input w-full border border-gray-300 rounded px-3 py-2"
                   data-member-id="${member.id}" data-field="primaryVisits"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Specialist Visits (per year)</label>
            <input type="number" min="0" value="${member.specialistVisits}"
                   class="usage-input w-full border border-gray-300 rounded px-3 py-2"
                   data-member-id="${member.id}" data-field="specialistVisits"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Therapy Sessions (per year)</label>
            <input type="number" min="0" value="${member.therapyVisits}"
                   class="usage-input w-full border border-gray-300 rounded px-3 py-2"
                   data-member-id="${member.id}" data-field="therapyVisits"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Lab Work (per year)</label>
            <input type="number" min="0" value="${member.labWork}"
                   class="usage-input w-full border border-gray-300 rounded px-3 py-2"
                   data-member-id="${member.id}" data-field="labWork"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Imaging Studies (per year)</label>
            <input type="number" min="0" value="${member.imaging}"
                   class="usage-input w-full border border-gray-300 rounded px-3 py-2"
                   data-member-id="${member.id}" data-field="imaging"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Physical Therapy (per year)</label>
            <input type="number" min="0" value="${member.physicalTherapy}"
                   class="usage-input w-full border border-gray-300 rounded px-3 py-2"
                   data-member-id="${member.id}" data-field="physicalTherapy"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
        </div>

        <!-- Medications -->
        <div class="border-t pt-4">
          <div class="flex justify-between items-center mb-3">
            <h4 class="font-medium">Medications</h4>
            <button class="text-blue-500 hover:text-blue-600 text-sm" 
                    data-action="add-medication" data-member-id="${member.id}"
                    ${!member.isActive ? 'disabled' : ''}>
              + Add Medication
            </button>
          </div>
          ${this.renderMedications(member)}
        </div>
      </div>
    `;
  }

  renderMedications(member) {
    if (member.medications.length === 0) {
      return `<p class="text-sm text-gray-500">No medications added</p>`;
    }

    return member.medications.map((med, index) => `
      <div class="bg-gray-50 rounded p-3 mb-2" data-med-id="${med.id}">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium mb-1">Medication Name</label>
            <input type="text" value="${med.name}" placeholder="e.g., Lisinopril"
                   class="usage-input w-full border border-gray-300 rounded px-2 py-1 text-sm"
                   data-member-id="${member.id}" data-field="medications[${index}].name"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1">Tier</label>
            <select class="usage-input w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    data-member-id="${member.id}" data-field="medications[${index}].tier"
                    ${!member.isActive ? 'disabled' : ''}>
              <option value="1" ${med.tier === 1 ? 'selected' : ''}>Tier 1 (Generic)</option>
              <option value="2" ${med.tier === 2 ? 'selected' : ''}>Tier 2 (Preferred Brand)</option>
              <option value="3" ${med.tier === 3 ? 'selected' : ''}>Tier 3 (Non-Preferred)</option>
              <option value="4" ${med.tier === 4 ? 'selected' : ''}>Tier 4 (Specialty)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1">Monthly Cost ($)</label>
            <input type="number" min="0" step="0.01" value="${med.monthlyCost}"
                   class="usage-input w-full border border-gray-300 rounded px-2 py-1 text-sm"
                   data-member-id="${member.id}" data-field="medications[${index}].monthlyCost"
                   ${!member.isActive ? 'disabled' : ''}>
          </div>
          <div class="flex items-end">
            <button class="text-red-400 hover:text-red-600 text-sm" 
                    data-action="remove-medication" 
                    data-member-id="${member.id}" data-med-index="${index}"
                    ${!member.isActive ? 'disabled' : ''}>
              Remove
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

}
