// Main entry point for Health Plan Comparison Tool
import { App } from '/insurance/src/components/App.js';
import { StorageManager } from '/insurance/src/utils/StorageManager.js';

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, starting app initialization...');
  
  try {
    // Initialize storage
    console.log('Initializing storage...');
    await StorageManager.init();
    console.log('Storage initialized');
    
    // Create and mount the main app
    console.log('Creating app instance...');
    const app = new App();
    
    console.log('Initializing app...');
    await app.init();
    
    console.log('App initialized successfully');
    
    // Hide loading screen
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'none';
      console.log('Loading screen hidden');
    }
    
  } catch (error) {
    console.error('Failed to initialize app:', error);
    console.error('Error stack:', error.stack);
    
    // Show error message
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `
        <div class="text-center">
          <div class="text-red-500 text-xl mb-4">⚠️ Application Error</div>
          <p class="text-gray-600 mb-4">Failed to load the Health Plan Comparison Tool</p>
          <p class="text-gray-500 text-sm mb-4">${error.message}</p>
          <button onclick="location.reload()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            Retry
          </button>
        </div>
      `;
    }
  }
});
