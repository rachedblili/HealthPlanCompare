// Warning Banner Component - Reusable disclaimer banners for results and estimates
export class WarningBanner {
  
  // Banner for calculation results
  static createResultsWarning() {
    return `
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <div class="ml-2 text-sm">
            <p class="text-amber-800 font-medium">These are estimates for comparison purposes</p>
            <p class="text-amber-700 mt-1">Actual costs may vary based on plan networks, covered services, and specific benefit details. Always verify with official plan documents and your insurance provider.</p>
          </div>
        </div>
      </div>
    `;
  }

  // Banner for service cost assumptions
  static createCostAssumptionsWarning() {
    return `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="ml-2 text-sm">
            <p class="text-blue-800 font-medium">Service costs are estimates based on national averages</p>
            <p class="text-blue-700 mt-1">Actual healthcare costs vary significantly by provider, location, and insurance negotiations. Use these as starting points for your analysis.</p>
          </div>
        </div>
      </div>
    `;
  }

  // Banner for plan data entry
  static createPlanDataWarning() {
    return `
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div class="ml-2 text-sm">
            <p class="text-orange-800 font-medium">Always verify plan details with official documents</p>
            <p class="text-orange-700 mt-1">Double-check deductibles, copays, networks, and covered services in your employer's benefits guide or the plan's Summary of Benefits and Coverage (SBC).</p>
          </div>
        </div>
      </div>
    `;
  }

  // Compact inline warning for specific numbers
  static createInlineWarning(text = "Estimate") {
    return `
      <span class="inline-flex items-center px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded ml-2" title="This is an estimate - verify with official plan documents">
        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        ${text}
      </span>
    `;
  }

  // Footer disclaimer for the entire app
  static createFooterDisclaimer() {
    return `
      <div class="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
        <p class="text-center">
          <strong>Disclaimer:</strong> This tool provides estimates for educational and comparison purposes only. 
          It is not a substitute for professional advice. Always consult official plan documents, insurance providers, 
          and qualified professionals before making healthcare or insurance decisions. 
          Users assume full responsibility for all decisions made using this tool.
        </p>
      </div>
    `;
  }
}