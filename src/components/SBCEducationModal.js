// SBC Education Modal Component - Educates users about Summary of Benefits and Coverage documents
export class SBCEducationModal {
  static show() {
    const modal = this.createModal();
    document.body.appendChild(modal);

    // Handle close
    const closeButtons = modal.querySelectorAll('[data-action="close-sbc-modal"]');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        modal.remove();
      });
    });

    // Handle clicking outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  static createModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-sm md:max-w-3xl lg:max-w-5xl w-full flex flex-col h-auto min-h-0 max-h-screen overflow-hidden">
        <div class="flex justify-between items-center p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
          <h2 class="text-lg md:text-2xl font-bold text-gray-900">What is a Summary of Benefits and Coverage (SBC)?</h2>
          <button data-action="close-sbc-modal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto flex-1">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h3 class="text-base font-semibold text-blue-900 mb-2">📋 What is an SBC?</h3>
            <p class="text-sm text-blue-800">
              A Summary of Benefits and Coverage (SBC) is a standardized document that all health insurance plans must provide. 
              It gives you a clear, easy-to-understand summary of what your plan covers and what it costs.
            </p>
          </div>

          <div>
            <h3 class="text-base font-semibold text-gray-900 mb-2">🔍 What Information Does an SBC Contain?</h3>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                <h4 class="text-sm font-medium text-green-900">Cost Information</h4>
                <ul class="text-xs text-green-800 mt-1 space-y-0.5">
                  <li>• Deductibles (individual & family)</li>
                  <li>• Out-of-pocket maximums</li>
                  <li>• Copays for visits and services</li>
                  <li>• Coinsurance percentages</li>
                </ul>
              </div>
              <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <h4 class="text-sm font-medium text-purple-900">Coverage Details</h4>
                <ul class="text-xs text-purple-800 mt-1 space-y-0.5">
                  <li>• What services are covered</li>
                  <li>• Prescription drug coverage</li>
                  <li>• Provider network information</li>
                  <li>• Exclusions and limitations</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-base font-semibold text-gray-900 mb-2">📄 View Real Example</h3>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 class="text-sm font-medium text-blue-900 mb-2">Official CMS Sample SBC</h4>
              <p class="text-xs text-blue-700 mb-3">See a complete SBC from Centers for Medicare & Medicaid Services</p>
              <a href="https://www.cms.gov/cciio/resources/forms-reports-and-other-resources/downloads/sample-completed-sbc-accessible-format-01-2020.pdf" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 class="inline-flex items-center justify-center w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                View Sample SBC
              </a>
            </div>
          </div>

          <div>
            <h3 class="text-base md:text-lg font-semibold text-gray-900 mb-3">📍 Where Can You Find Your SBC?</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="flex items-start p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div class="flex-shrink-0 mt-1">
                  <span class="text-lg">🏢</span>
                </div>
                <div class="ml-3">
                  <h4 class="font-medium text-amber-900">From Your Employer</h4>
                  <p class="text-sm text-amber-800">Check your employee benefits portal, HR department, or annual enrollment materials.</p>
                </div>
              </div>
              
              <div class="flex items-start p-3 bg-green-50 border border-green-200 rounded-lg">
                <div class="flex-shrink-0 mt-1">
                  <span class="text-lg">🌐</span>
                </div>
                <div class="ml-3">
                  <h4 class="font-medium text-green-900">Insurance Company Website</h4>
                  <p class="text-sm text-green-800">Log into your member portal or browse plan documents on the insurer's website.</p>
                </div>
              </div>
              
              <div class="flex items-start p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div class="flex-shrink-0 mt-1">
                  <span class="text-lg">📧</span>
                </div>
                <div class="ml-3">
                  <h4 class="font-medium text-blue-900">Direct from Insurer</h4>
                  <p class="text-sm text-blue-800">Call your insurance company directly - they're required to provide SBC documents upon request.</p>
                </div>
              </div>
              
              <div class="flex items-start p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div class="flex-shrink-0 mt-1">
                  <span class="text-lg">🛒</span>
                </div>
                <div class="ml-3">
                  <h4 class="font-medium text-purple-900">Healthcare.gov</h4>
                  <p class="text-sm text-purple-800">If you're shopping for marketplace plans, SBCs are available for all qualified health plans.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 md:p-4">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <div class="ml-2">
                <h4 class="text-sm font-medium text-orange-800">Important Note</h4>
                <p class="text-sm text-orange-700 mt-1">
                  SBCs don't include premium costs - those are set by your employer. You'll need to get premium information 
                  from your HR department or benefits enrollment system.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end p-4 md:p-6 border-t border-gray-200 flex-shrink-0">
          <button data-action="close-sbc-modal" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
            Got It!
          </button>
        </div>
      </div>
    `;
    return modal;
  }
}