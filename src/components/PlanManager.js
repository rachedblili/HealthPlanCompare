// Plan Manager Component - Handles plan input, PDF analysis, and search
import { EventEmitter } from '../utils/EventEmitter.js';
import { StorageManager } from '../utils/StorageManager.js';
import { PDFAnalyzer } from '../utils/PDFAnalyzer.js';
import { PlanSearchAgent } from '../utils/PlanSearchAgent.js';
import { WarningBanner } from './WarningBanner.js';
import { SBCEducationModal } from './SBCEducationModal.js';
import { EnvConfig } from '../utils/EnvConfig.js';

export class PlanManager extends EventEmitter {
  constructor() {
    super();
    this.plans = [];
    this.pdfAnalyzer = new PDFAnalyzer();
    this.searchAgent = new PlanSearchAgent();
    this.isProcessing = false;
    this.saveTimeout = null;
    this.renderTimeout = null;
    this.isInitialized = false;
  }

  async init() {
    // Load saved plans
    this.plans = StorageManager.loadPlans();
    this.render();
    this.setupEventListeners();
    this.isInitialized = true;
    console.log('PlanManager initialized with', this.plans.length, 'plans');
  }

  setupEventListeners() {
    const container = document.getElementById('plan-manager-container');
    
    // Add plan button
    container.addEventListener('click', (e) => {
      // Find the button element (in case click is on SVG child)
      const button = e.target.closest('[data-action]');
      
      if (button && button.dataset.action === 'add-plan') {
        this.showAddPlanModal();
      }
      
      if (button && button.dataset.action === 'remove-plan') {
        const planId = button.dataset.planId;
        this.removePlan(planId);
      }
      
      if (button && button.dataset.action === 'edit-plan') {
        const planId = button.dataset.planId;
        console.log(`📝 Edit plan clicked for ID: ${planId}`);
        this.editPlan(planId);
      }
    });

    // File drop handling
    const dropZone = container.querySelector('.drag-drop-zone');
    if (dropZone) {
      this.setupFileDropZone(dropZone);
    }
  }

  setupFileDropZone(dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', (e) => this.handleFileDrop(e), false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async handleFileDrop(e) {
    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      this.showError('Please drop PDF files only');
      return;
    }

    for (const file of pdfFiles) {
      await this.processPDF(file);
    }
  }

  async processPDF(file) {
    console.log(`🔄 Starting PDF processing for: ${file.name}`);
    this.setProcessingState(true, `Starting analysis of ${file.name}...`);
    
    // Show LLM configuration UI in local mode only
    const shouldOfferLocalLLM = await EnvConfig.isLocalLLMEnabled();
    if (shouldOfferLocalLLM && !this.hasOfferedLLM) {
      this.hasOfferedLLM = true;
      setTimeout(async () => {
        const useEnhanced = await this.offerEnhancedAnalysis();
        if (useEnhanced) {
          // Re-analyze the file with LLM if they configured it
          this.setProcessingState(true, `Re-analyzing ${file.name} with enhanced AI...`);
        }
      }, 500);
    }
    
    try {
      console.log(`📖 About to call pdfAnalyzer.analyzeSBC`);
      const planData = await this.pdfAnalyzer.analyzeSBC(file, (status) => {
        console.log(`📊 PDF Analysis Status: ${status}`);
        this.setProcessingState(true, `${file.name}: ${status}`);
      });
      
      console.log(`✅ PDF analysis complete, got data:`, planData);
      
      if (planData && Object.keys(planData).length > 3) { // Ensure we got meaningful data
        console.log(`📝 Preparing plan data with ID and metadata`);
        planData.id = this.generatePlanId();
        planData.source = 'pdf_upload';
        planData.fileName = file.name;
        planData.uploadDate = new Date().toISOString();
        
        console.log(`📋 Showing plan review form for premium input and data verification`);
        this.showPlanReviewForm(planData, file.name);
      } else {
        console.log(`❌ Insufficient plan data extracted`);
        this.showError(`Could not extract sufficient plan data from ${file.name}. Please try manual entry.`);
      }
    } catch (error) {
      console.error('❌ PDF processing error:', error);
      let errorMessage = `Error processing ${file.name}: `;
      
      if (error.message.includes('timeout')) {
        errorMessage += 'Processing took too long. The PDF may be corrupted or too large.';
      } else if (error.message.includes('empty')) {
        errorMessage += 'The PDF appears to be empty or contains no readable text.';
      } else {
        errorMessage += error.message;
      }
      
      this.showError(errorMessage);
    } finally {
      console.log(`🔄 Setting processing state to false`);
      this.setProcessingState(false);
      console.log(`✅ PDF processing cleanup complete`);
    }
  }


  showAddPlanModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Add Health Plan</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Need Help Finding Your Plan Documents?</label>
            <button class="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 py-3 px-4 rounded-lg flex items-center justify-center"
                    data-action="show-sbc-education">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              What is an SBC? Where do I find it?
            </button>
            <p class="text-xs text-gray-500 mt-1">Learn about Summary of Benefits and Coverage documents and where to find yours</p>
          </div>
          
          <div class="text-center text-gray-500">OR</div>
          
          <div>
            <label class="block text-sm font-medium mb-2">Upload PDF Document</label>
            <div class="drag-drop-zone border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div class="text-gray-500">
                <svg class="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                <p>Drop PDF files here or</p>
                <button class="text-blue-500 hover:text-blue-600 underline" data-action="browse-files">
                  browse files
                </button>
                <input type="file" accept=".pdf" multiple class="hidden" id="plan-file-input">
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">Upload Summary of Benefits and Coverage (SBC) documents</p>
          </div>
          
          <div class="text-center text-gray-500">OR</div>
          
          <div>
            <button class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded"
                    data-action="manual-entry">
              Enter Plan Details Manually
            </button>
          </div>
        </div>
        
        <div class="mt-6 flex justify-end space-x-3">
          <button class="px-4 py-2 text-gray-600 hover:text-gray-800" data-action="cancel">Cancel</button>
        </div>
      </div>
    `;

    // Handle modal interactions
    modal.addEventListener('click', async (e) => {
      if (e.target.matches('[data-action="show-sbc-education"]')) {
        SBCEducationModal.show();
      }
      
      if (e.target.matches('[data-action="browse-files"]')) {
        const fileInput = modal.querySelector('#plan-file-input');
        if (fileInput) {
          fileInput.click();
        }
      }
      
      if (e.target.matches('[data-action="manual-entry"]')) {
        modal.remove();
        this.showManualEntryForm();
      }
      
      if (e.target.matches('[data-action="cancel"]') || e.target === modal) {
        modal.remove();
      }
    });

    // Handle file input
    const fileInput = modal.querySelector('#plan-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        modal.remove();
        
        for (const file of files) {
          await this.processPDF(file);
        }
      });
    }

    document.body.appendChild(modal);
  }

  renderAnalysisStatus(planData) {
    if (planData.extractionMethod === 'hybrid' && planData.llmAnalyzed) {
      const qualityColors = {
        'HIGH': 'bg-green-50 border-green-200 text-green-700',
        'MEDIUM': 'bg-yellow-50 border-yellow-200 text-yellow-700', 
        'LOW': 'bg-orange-50 border-orange-200 text-orange-700'
      };
      
      const qualityColor = qualityColors[planData.llmQuality] || qualityColors['MEDIUM'];
      
      return `
        <div class="mb-4 p-4 ${qualityColor} border rounded-lg">
          <div class="flex items-start">
            <span class="text-xl mr-3">🤖</span>
            <div class="text-sm">
              <p class="font-medium mb-1">✨ AI-Enhanced Analysis Complete</p>
              <p class="mb-2">This document was analyzed using advanced AI for better accuracy.</p>
              <div class="text-xs">
                <strong>Extraction Quality:</strong> ${planData.llmQuality}
                ${planData.llmNotes ? `<br><strong>Notes:</strong> ${planData.llmNotes}` : ''}
                ${planData.llmMissingFields && planData.llmMissingFields.length > 0 ? 
                  `<br><strong>May need manual review:</strong> ${planData.llmMissingFields.join(', ')}` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (planData.extractionMethod === 'regex') {
      return `
        <div class="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div class="flex items-start">
            <span class="text-xl mr-3">🔍</span>
            <div class="text-sm text-gray-700">
              <p class="font-medium mb-1">Basic Pattern Analysis</p>
              <p>Data extracted using pattern matching. For better accuracy, consider enabling AI analysis in settings.</p>
            </div>
          </div>
        </div>
      `;
    }
    
    return '';
  }

  showPlanReviewForm(planData, fileName, isEditMode = false) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 max-h-screen overflow-y-auto">
        <h3 class="text-xl font-semibold mb-4">📋 Review Plan Data: ${fileName}</h3>
        
        <!-- Analysis Status Banner -->
        ${this.renderAnalysisStatus(planData)}

        <form id="plan-review-form" class="space-y-8">
          <!-- CRITICAL: Premium Input Section -->
          <div class="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-xl p-6 shadow-lg">
            <div class="flex items-center mb-4">
              <div class="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center mr-4 shadow-md">
                <span class="text-xl">💰</span>
              </div>
              <div>
                <h3 class="text-xl font-bold text-orange-900">Your Premium Costs</h3>
                <p class="text-sm text-orange-700 font-medium">Required - This is the most important information we need</p>
              </div>
            </div>
            
            <div class="bg-white rounded-lg p-5 border-2 border-orange-200 shadow-inner">
              <div class="mb-4 p-3 bg-orange-100 rounded-lg border border-orange-200">
                <p class="text-sm text-orange-800 font-medium">
                  ⚠️ <strong>SBC documents don't include premium costs.</strong> Enter what you actually pay monthly after employer contribution.
                </p>
                <p class="text-xs text-orange-700 mt-1">💡 Check your paystub, benefits portal, or HR materials</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-bold text-orange-900 mb-2">Individual Premium *</label>
                  <div class="relative">
                    <span class="absolute left-3 top-3 text-gray-500 font-medium">$</span>
                    <input type="number" name="monthlyPremium" value="${planData.monthlyPremium || ''}" 
                           class="w-full border-2 border-orange-300 rounded-lg pl-8 pr-3 py-3 text-lg font-semibold bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:bg-orange-50" 
                           placeholder="0" step="0.01" min="0" required>
                  </div>
                  <p class="text-xs text-orange-700 mt-1 font-medium">Employee only</p>
                </div>
                <div>
                  <label class="block text-sm font-bold text-orange-900 mb-2">Employee + Spouse</label>
                  <div class="relative">
                    <span class="absolute left-3 top-3 text-gray-500 font-medium">$</span>
                    <input type="number" name="spousePremium" value="${planData.spousePremium || ''}" 
                           class="w-full border-2 border-orange-300 rounded-lg pl-8 pr-3 py-3 text-lg font-semibold bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:bg-orange-50" 
                           placeholder="0" step="0.01" min="0">
                  </div>
                  <p class="text-xs text-orange-700 mt-1 font-medium">Employee + spouse only</p>
                </div>
                <div>
                  <label class="block text-sm font-bold text-orange-900 mb-2">Family Premium</label>
                  <div class="relative">
                    <span class="absolute left-3 top-3 text-gray-500 font-medium">$</span>
                    <input type="number" name="familyPremium" value="${planData.familyPremium || ''}" 
                           class="w-full border-2 border-orange-300 rounded-lg pl-8 pr-3 py-3 text-lg font-semibold bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:bg-orange-50" 
                           placeholder="0" step="0.01" min="0">
                  </div>
                  <p class="text-xs text-orange-700 mt-1 font-medium">Employee + family</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Collapsible Plan Details Section -->
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <button type="button" class="w-full p-4 bg-gray-50 hover:bg-gray-100 text-left transition-colors focus:outline-none focus:bg-gray-100" 
                    onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.toggle-icon').textContent = this.nextElementSibling.classList.contains('hidden') ? '▶' : '▼'">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="font-semibold text-gray-900">📋 Plan Details & Benefits</h4>
                  <p class="text-sm text-gray-600">Review and adjust extracted plan information (optional)</p>
                </div>
                <span class="toggle-icon text-gray-500 text-lg">▼</span>
              </div>
            </button>
            <div class="bg-white border-t border-gray-200">
              <div class="p-6 space-y-6">
                
                <!-- Basic Plan Information -->
                <div>
                  <h5 class="font-medium text-gray-900 mb-3">🏥 Plan Information</h5>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                      <input type="text" name="name" value="${planData.name || ''}" 
                             class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Insurance Company</label>
                      <input type="text" name="insurer" value="${planData.insurer || ''}" 
                             class="w-full border border-gray-300 rounded-md px-3 py-2" required>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                      <select name="planType" class="w-full border border-gray-300 rounded-md px-3 py-2">
                        <option value="">Select Type</option>
                        <option value="PPO" ${planData.planType === 'PPO' ? 'selected' : ''}>PPO</option>
                        <option value="HMO" ${planData.planType === 'HMO' ? 'selected' : ''}>HMO</option>
                        <option value="EPO" ${planData.planType === 'EPO' ? 'selected' : ''}>EPO</option>
                        <option value="HSA" ${planData.planType === 'HSA' ? 'selected' : ''}>HSA/HDHP</option>
                        <option value="POS" ${planData.planType === 'POS' ? 'selected' : ''}>POS</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Plan Year</label>
                      <input type="number" name="year" value="${planData.year || new Date().getFullYear()}" 
                             class="w-full border border-gray-300 rounded-md px-3 py-2" min="2020" max="2030">
                    </div>
                  </div>
                </div>

                <!-- Deductibles & Limits -->
                <div>
                  <h5 class="font-medium text-gray-900 mb-3">🏦 Deductibles & Limits</h5>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Individual Deductible</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="individualDeductible" value="${planData.individualDeductible || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="50" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Family Deductible</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="familyDeductible" value="${planData.familyDeductible || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="50" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Individual Out-of-Pocket Max</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="individualOOPMax" value="${planData.individualOOPMax || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="50" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Family Out-of-Pocket Max</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="familyOOPMax" value="${planData.familyOOPMax || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="50" min="0">
                </div>
              </div>
            </div>
          </div>

          <!-- Medical Copays & Coinsurance -->
          <div class="border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-3">👩‍⚕️ Medical Services</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Primary Care Copay</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="primaryCopay" value="${planData.primaryCopay || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="5" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Specialist Copay</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="specialistCopay" value="${planData.specialistCopay || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="5" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Coinsurance %</label>
                <div class="relative">
                  <input type="number" name="coinsurance" value="${(planData.coinsurance || 0) * 100}" 
                         class="w-full border border-gray-300 rounded-md px-3 py-2" step="5" min="0" max="100">
                  <span class="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Prescription Drugs -->
          <div class="border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-3">💊 Prescription Drug Coverage</h4>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Prescription Deductible</label>
              <div class="relative max-w-xs">
                <span class="absolute left-3 top-2 text-gray-500">$</span>
                <input type="number" name="rxDeductible" value="${planData.rxDeductible || ''}" 
                       class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="50" min="0">
              </div>
              <p class="text-xs text-gray-500 mt-1">Leave blank if same as medical deductible</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tier 1 (Generic)</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="tier1DrugCost" value="${planData.tier1DrugCost || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="1" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tier 2 (Preferred)</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="tier2DrugCost" value="${planData.tier2DrugCost || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="5" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tier 3 (Non-Preferred)</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="tier3DrugCost" value="${planData.tier3DrugCost || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="5" min="0">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tier 4 (Specialty)</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" name="specialtyDrugCost" value="${planData.specialtyDrugCost || ''}" 
                         class="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2" step="0.01" min="0">
                </div>
                <p class="text-xs text-gray-500 mt-1">Enter dollar amount for copay or decimal for coinsurance (e.g., 0.25 for 25%)</p>
              </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button type="button" class="px-6 py-2 text-gray-600 hover:text-gray-800" data-action="cancel">
              Cancel
            </button>
            <button type="submit" class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md">
              ${isEditMode ? 'Save Changes' : 'Add Plan to Comparison'}
            </button>
          </div>
        </form>
      </div>
    `;

    // Handle form submission
    modal.querySelector('#plan-review-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const updatedPlanData = { ...planData };
      
      // Extract form data
      for (const [key, value] of formData.entries()) {
        if (value !== '') {
          if (key === 'coinsurance') {
            updatedPlanData[key] = parseFloat(value) / 100; // Convert percentage to decimal
          } else if (['monthlyPremium', 'spousePremium', 'familyPremium', 'individualDeductible', 'familyDeductible', 
                     'individualOOPMax', 'familyOOPMax', 'primaryCopay', 'specialistCopay', 
                     'rxDeductible', 'tier1DrugCost', 'tier2DrugCost', 'tier3DrugCost', 
                     'specialtyDrugCost', 'year'].includes(key)) {
            updatedPlanData[key] = parseFloat(value) || 0;
          } else {
            updatedPlanData[key] = value;
          }
        }
      }
      
      modal.remove();
      
      if (isEditMode) {
        // Update existing plan
        this.updatePlan(updatedPlanData);
        this.showSuccess(`✅ Plan updated: ${updatedPlanData.name || 'Plan'}`);
      } else {
        // Add new plan
        this.addPlan(updatedPlanData);
        this.showSuccess(`✅ Plan added: ${updatedPlanData.name || 'New Plan'}`);
      }
    });

    // Handle cancel
    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="cancel"]') || e.target === modal) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
    
    // Focus on the premium input since it's required
    setTimeout(() => {
      const premiumInput = modal.querySelector('input[name="monthlyPremium"]');
      if (premiumInput) premiumInput.focus();
    }, 100);
  }

  showManualEntryForm(existingPlan = null) {
    // For manual entry, we can reuse the same form but with empty data
    const emptyPlanData = {
      name: '',
      insurer: '',
      planType: '',
      year: new Date().getFullYear(),
      monthlyPremium: 0,
      spousePremium: 0,
      familyPremium: 0,
      individualDeductible: 0,
      familyDeductible: 0,
      individualOOPMax: 0,
      familyOOPMax: 0,
      primaryCopay: 0,
      specialistCopay: 0,
      coinsurance: 0,
      rxDeductible: 0,
      tier1DrugCost: 0,
      tier2DrugCost: 0,
      tier3DrugCost: 0,
      specialtyDrugCost: 0,
      source: 'manual_entry',
      ...existingPlan
    };
    
    this.showPlanReviewForm(emptyPlanData, existingPlan ? `Edit ${existingPlan.name}` : 'Manual Plan Entry', !!existingPlan);
  }

  addPlan(planData) {
    console.log(`➕ addPlan called with:`, planData);
    this.plans.push(planData);
    console.log(`💾 Plan added to array, triggering debouncedSave`);
    this.debouncedSave();
    console.log(`🎨 Triggering debouncedRender`);
    this.debouncedRender();
    if (this.isInitialized) {
      console.log(`📡 Emitting plansChanged event`);
      this.emit('plansChanged', this.plans);
      console.log(`✅ plansChanged event emitted`);
    } else {
      console.log(`⏸ Not emitting plansChanged - not initialized`);
    }
  }

  updatePlan(updatedPlanData) {
    console.log(`🔄 updatePlan called with:`, updatedPlanData);
    const planIndex = this.plans.findIndex(p => p.id === updatedPlanData.id);
    if (planIndex !== -1) {
      this.plans[planIndex] = updatedPlanData;
      console.log(`💾 Plan updated in array, triggering debouncedSave`);
      this.debouncedSave();
      console.log(`🎨 Triggering debouncedRender`);
      this.debouncedRender();
      if (this.isInitialized) {
        console.log(`📡 Emitting plansChanged event`);
        this.emit('plansChanged', this.plans);
        console.log(`✅ plansChanged event emitted`);
      }
    } else {
      console.error(`❌ Plan not found for update with ID: ${updatedPlanData.id}`);
    }
  }

  removePlan(planId) {
    this.plans = this.plans.filter(plan => plan.id !== planId);
    this.debouncedSave();
    this.debouncedRender();
    if (this.isInitialized) {
      this.emit('plansChanged', this.plans);
    }
  }

  editPlan(planId) {
    console.log(`🔧 editPlan called with ID: ${planId}`);
    const plan = this.plans.find(p => p.id === planId);
    console.log(`📋 Found plan:`, plan);
    if (plan) {
      this.showManualEntryForm(plan);
    } else {
      console.error(`❌ Plan not found with ID: ${planId}`);
    }
  }

  getPlans() {
    return [...this.plans];
  }

  importPlans(plans) {
    this.plans = plans.map(plan => ({ ...plan }));
    this.debouncedSave();
    this.debouncedRender();
    if (this.isInitialized) {
      this.emit('plansChanged', this.plans);
    }
  }

  savePlans() {
    try {
      StorageManager.savePlans(this.plans);
    } catch (error) {
      console.warn('Failed to save plans to localStorage:', error);
    }
  }
  
  debouncedSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.savePlans();
    }, 250); // 250ms debounce
  }
  
  debouncedRender() {
    clearTimeout(this.renderTimeout);
    this.renderTimeout = setTimeout(() => {
      this.render();
    }, 50); // 50ms debounce for faster UI updates
  }

  async offerEnhancedAnalysis() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 class="text-lg font-semibold mb-4">🤖 Enable Enhanced Analysis?</h3>
          
          <div class="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <div class="flex items-start">
              <span class="text-2xl mr-3">✨</span>
              <div class="text-sm">
                <p class="font-medium text-gray-900 mb-2">Get Better Results with AI</p>
                <p class="text-gray-700 mb-2">
                  Our basic analysis uses pattern matching, but we can provide much better results with AI assistance:
                </p>
                <ul class="text-gray-600 text-xs space-y-1">
                  <li>• More accurate data extraction</li>
                  <li>• Better handling of complex document layouts</li>
                  <li>• Intelligent plan summaries and insights</li>
                  <li>• Personalized recommendations</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-sm text-red-700">
              <strong>⚠️ Local Development Mode:</strong> This configuration will expose API keys in your browser. 
              Only use for local development, never on deployed websites.
            </p>
          </div>

          <div class="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p class="text-sm text-gray-700">
              <strong>Your choice:</strong> Requires your own OpenAI or Anthropic API key. 
              Keys are stored locally in browser storage.
            </p>
          </div>

          <div class="flex justify-between space-x-3">
            <button class="px-4 py-2 text-gray-600 hover:text-gray-800" data-action="continue-basic">
              Continue with Basic Analysis
            </button>
            <button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md" data-action="setup-ai">
              Set Up AI Analysis
            </button>
          </div>
        </div>
      `;

      modal.addEventListener('click', async (e) => {
        if (e.target.matches('[data-action="setup-ai"]')) {
          modal.remove();
          // Trigger local LLM configuration
          const configured = await this.pdfAnalyzer.offerLLMConfiguration();
          if (configured) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
        
        if (e.target.matches('[data-action="continue-basic"]') || e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });

      document.body.appendChild(modal);
    });
  }

  generatePlanId() {
    return 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  setProcessingState(isProcessing, message = '') {
    this.isProcessing = isProcessing;
    const statusElement = document.querySelector('#processing-status');
    
    if (statusElement) {
      if (isProcessing) {
        statusElement.innerHTML = `
          <div class="flex items-center text-blue-600">
            <div class="spinner mr-2"></div>
            ${message}
          </div>
        `;
        statusElement.classList.remove('hidden');
      } else {
        statusElement.classList.add('hidden');
      }
    }
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
      type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  render() {
    const container = document.getElementById('plan-manager-container');
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-semibold">Your Health Plans</h2>
          <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
                  data-action="add-plan">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Add Plan
          </button>
        </div>

        <!-- Important Warning Banner -->
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-amber-800">
                Important: Verify Plan Details
              </h3>
              <div class="mt-2 text-sm text-amber-700">
                <p>
                  This tool provides estimates based on available plan information. Always verify deductibles, copays, 
                  out-of-pocket maximums, and covered services with your official plan documents, benefits portal, 
                  or insurance provider before making healthcare decisions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div id="processing-status" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4"></div>

        ${this.plans.length === 0 ? this.renderEmptyState() : this.renderPlansList()}
      </div>
    `;
  }

  renderEmptyState() {
    return `
      <div class="text-center py-12 bg-gray-50 rounded-lg">
        <svg class="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Plans Added Yet</h3>
        <p class="text-gray-600 mb-6 max-w-md mx-auto">
          Get started by adding your health insurance plans. You can search for plans online, 
          upload PDF documents, or enter details manually.
        </p>
        <button class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
                data-action="add-plan">
          Add Your First Plan
        </button>
      </div>
    `;
  }

  renderPlansList() {
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${this.plans.map(plan => this.renderPlanCard(plan)).join('')}
      </div>
    `;
  }

  renderPlanCard(plan) {
    return `
      <div class="plan-card bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">${plan.name || 'Unnamed Plan'}</h3>
            <p class="text-sm text-gray-600">${plan.insurer || 'Unknown Insurer'}</p>
          </div>
          <div class="flex space-x-2">
            <button class="text-gray-400 hover:text-gray-600" data-action="edit-plan" data-plan-id="${plan.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="text-red-400 hover:text-red-600" data-action="remove-plan" data-plan-id="${plan.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="space-y-2 text-sm">
          <!-- Premium Tiers -->
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-gray-600">Individual Premium:</span>
              <span class="font-medium">${this.formatCurrency(plan.monthlyPremium || 0)}</span>
            </div>
            ${plan.spousePremium ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Employee + Spouse:</span>
                <span class="font-medium">${this.formatCurrency(plan.spousePremium)}</span>
              </div>
            ` : ''}
            ${plan.familyPremium ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Family Premium:</span>
                <span class="font-medium">${this.formatCurrency(plan.familyPremium)}</span>
              </div>
            ` : ''}
          </div>
          
          <!-- Other plan details -->
          <div class="pt-2 border-t border-gray-100">
            <div class="flex justify-between">
              <span class="text-gray-600">Deductible:</span>
              <span class="font-medium">${this.formatCurrency(plan.individualDeductible || 0)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Out-of-Pocket Max:</span>
              <span class="font-medium">${this.formatCurrency(plan.individualOOPMax || 0)}</span>
            </div>
          </div>
        </div>
        
        ${plan.source ? `
          <div class="mt-4 pt-4 border-t border-gray-200">
            <div class="text-xs text-gray-500">
              ${plan.source === 'pdf_upload' ? '📄 Uploaded PDF' : 
                plan.source === 'search' ? '🔍 Found Online' : '✏️ Manual Entry'}
              ${plan.uploadDate ? ` • ${new Date(plan.uploadDate).toLocaleDateString()}` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}
