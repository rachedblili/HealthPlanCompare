// Disclaimer Modal Component - Shows legal disclaimers and terms of use
import { EventEmitter } from '../utils/EventEmitter.js';

export class DisclaimerModal extends EventEmitter {
  constructor() {
    super();
    this.isAccepted = false;
  }

  show() {
    return new Promise((resolve) => {
      // Check if disclaimer has been accepted before
      const hasAccepted = localStorage.getItem('disclaimer_accepted');
      if (hasAccepted === 'true') {
        this.isAccepted = true;
        resolve(true);
        return;
      }

      const modal = this.createModal();
      document.body.appendChild(modal);

      // Handle acceptance
      const acceptButton = modal.querySelector('#accept-disclaimer');
      const closeButton = modal.querySelector('#close-disclaimer');

      acceptButton.addEventListener('click', () => {
        localStorage.setItem('disclaimer_accepted', 'true');
        this.isAccepted = true;
        modal.remove();
        resolve(true);
      });

      closeButton.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      // Prevent closing by clicking outside
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          // Don't allow closing by clicking outside
          return;
        }
      });
    });
  }

  createModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div class="flex items-center mb-4">
          <div class="bg-blue-100 rounded-full p-2 mr-3">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Important Notice</h2>
        </div>

        <div class="space-y-4 text-sm text-gray-700 mb-6">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="font-semibold text-blue-900 mb-2">📋 What This Tool Does</h3>
            <p>This Health Plan Comparison Tool helps you analyze and compare insurance plans based on your family's estimated healthcare usage. It's designed to simplify complex insurance calculations and provide insights to support your decision-making process.</p>
          </div>

          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 class="font-semibold text-amber-900 mb-2">⚠️ Important Limitations</h3>
            <ul class="list-disc list-inside space-y-1 text-amber-800">
              <li><strong>Estimates Only:</strong> All calculations are estimates based on your inputs and assumptions</li>
              <li><strong>Not Financial Advice:</strong> This tool does not provide professional financial or medical advice</li>
              <li><strong>Plan Details Vary:</strong> Actual plan benefits, networks, and costs may differ from estimates</li>
              <li><strong>Personal Research Required:</strong> Always verify plan details with official documents and insurers</li>
            </ul>
          </div>

          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 class="font-semibold text-gray-900 mb-2">🤝 Your Responsibility</h3>
            <p>By using this tool, you understand and agree that:</p>
            <ul class="list-disc list-inside space-y-1 mt-2">
              <li>You are responsible for all healthcare and insurance decisions</li>
              <li>You will verify all information with official sources before making decisions</li>
              <li>You will not hold the creators of this tool liable for any decisions you make</li>
              <li>This tool is provided "as-is" without warranties of any kind</li>
            </ul>
          </div>

          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 class="font-semibold text-green-900 mb-2">✅ How to Use This Tool Responsibly</h3>
            <ul class="list-disc list-inside space-y-1 text-green-800">
              <li>Use this as <em>one tool among many</em> in your research process</li>
              <li>Always read official plan documents (Summary of Benefits and Coverage)</li>
              <li>Contact insurance companies directly with specific questions</li>
              <li>Consider consulting with insurance brokers or financial advisors</li>
              <li>Double-check that your doctors and medications are covered</li>
            </ul>
          </div>

          <div class="text-xs text-gray-600 border-t pt-4 mt-4">
            <p><strong>Privacy Notice:</strong> All your data is processed locally in your browser and never sent to external servers. Your personal information remains private and secure on your device.</p>
          </div>
        </div>

        <div class="flex justify-between items-center">
          <button id="close-disclaimer" class="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded">
            I Don't Agree
          </button>
          <button id="accept-disclaimer" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">
            I Understand and Agree
          </button>
        </div>

        <p class="text-xs text-gray-500 mt-2 text-center">
          This agreement will be remembered for this browser session.
        </p>
      </div>
    `;
    return modal;
  }

  // Method to reset acceptance (for testing or if user wants to see disclaimer again)
  static resetAcceptance() {
    localStorage.removeItem('disclaimer_accepted');
  }
}