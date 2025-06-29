// Client-side wrapper for serverless LLM functions with error handling
export class ServerlessLLMClient {
  constructor() {
    this.baseURL = window.location.origin; // Use same domain for API calls
    this.apiPrefix = '/insurance/api'; // Match nginx location path
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second base delay
  }

  async analyzePDF(pdfText, options = {}) {
    const { provider = 'openai', showProgress = null } = options;
    
    return await this.makeRequest(`${this.apiPrefix}/analyze-pdf`, {
      pdfText,
      provider
    }, {
      operation: 'PDF Analysis',
      showProgress,
      timeout: 30000 // 30 second timeout for PDF analysis
    });
  }

  async generateInsights(plans, familyData, calculationResults, options = {}) {
    const { provider = 'openai', showProgress = null } = options;
    
    return await this.makeRequest(`${this.apiPrefix}/generate-insights`, {
      plans,
      familyData,
      calculationResults,
      provider
    }, {
      operation: 'Insights Generation',
      showProgress,
      timeout: 20000 // 20 second timeout for insights
    });
  }

  async generateSummary(planData, options = {}) {
    const { provider = 'openai', showProgress = null } = options;
    
    return await this.makeRequest(`${this.apiPrefix}/generate-summary`, {
      planData,
      provider
    }, {
      operation: 'Summary Generation',
      showProgress,
      timeout: 15000 // 15 second timeout for summaries
    });
  }

  async makeRequest(endpoint, data, options = {}) {
    const { operation, showProgress, timeout = 15000 } = options;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        if (showProgress) {
          showProgress(`${operation} in progress${attempt > 1 ? ` (attempt ${attempt})` : ''}...`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ServerlessError(response.status, errorData, operation);
        }

        const result = await response.json();
        
        if (showProgress) {
          showProgress(`${operation} completed successfully!`);
        }

        return result;

      } catch (error) {
        if (error.name === 'AbortError') {
          if (attempt === this.retryAttempts) {
            throw new ServerlessError(408, {
              error: 'Request timeout',
              type: 'TIMEOUT',
              message: `${operation} timed out. Please try again.`
            }, operation);
          }
          continue; // Retry on timeout
        }

        if (error instanceof ServerlessError) {
          // Handle specific error types
          if (error.isRetryable() && attempt < this.retryAttempts) {
            const delay = this.calculateRetryDelay(attempt, error.retryAfter);
            if (showProgress) {
              showProgress(`${operation} busy, retrying in ${Math.ceil(delay/1000)} seconds...`);
            }
            await this.sleep(delay);
            continue;
          }
          
          // Show user-friendly error message
          this.showUserError(error, showProgress);
          throw error;
        }

        // Network or other errors
        if (attempt === this.retryAttempts) {
          const networkError = new ServerlessError(0, {
            error: 'Network error',
            type: 'NETWORK_ERROR', 
            message: `Unable to connect to ${operation} service. Please check your internet connection and try again.`
          }, operation);
          
          this.showUserError(networkError, showProgress);
          throw networkError;
        }
        
        // Retry network errors
        const delay = this.calculateRetryDelay(attempt);
        if (showProgress) {
          showProgress(`Connection failed, retrying in ${Math.ceil(delay/1000)} seconds...`);
        }
        await this.sleep(delay);
      }
    }
  }

  calculateRetryDelay(attempt, retryAfter = null) {
    if (retryAfter) {
      return retryAfter * 1000; // Convert to milliseconds
    }
    
    // Exponential backoff with jitter
    const baseDelay = this.retryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.min(baseDelay + jitter, 10000); // Max 10 seconds
  }

  showUserError(error, showProgress) {
    if (!showProgress) return;
    
    let message = error.userMessage;
    
    // Add specific guidance based on error type
    if (error.type === 'RATE_LIMIT') {
      const resetTime = new Date(error.resetTime);
      const waitTime = Math.ceil((error.resetTime - Date.now()) / 60000);
      message += ` Please wait ${waitTime} minute(s) before trying again.`;
    } else if (error.type === 'SYSTEM_BUSY') {
      message += ' Our system is experiencing high demand right now.';
    }
    
    showProgress(message, 'error');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check system status
  async checkSystemStatus() {
    try {
      const response = await fetch(`${this.baseURL}/api/status`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Could not check system status:', error);
    }
    
    return { available: true, message: 'Status unknown' };
  }
}

// Custom error class for serverless function errors
export class ServerlessError extends Error {
  constructor(status, errorData, operation) {
    super(errorData.message || 'Unknown error');
    
    this.name = 'ServerlessError';
    this.status = status;
    this.type = errorData.type || 'UNKNOWN_ERROR';
    this.operation = operation;
    this.userMessage = errorData.message || 'An unexpected error occurred';
    this.resetTime = errorData.resetTime;
    this.retryAfter = errorData.retryAfter;
    this.estimatedWaitTime = errorData.estimatedWaitTime;
  }

  isRetryable() {
    return this.type === 'SYSTEM_BUSY' || 
           this.status === 429 || // Rate limited
           this.status === 503 || // Service unavailable
           this.status === 502 || // Bad gateway
           this.status === 504;   // Gateway timeout
  }

  isRateLimited() {
    return this.type === 'RATE_LIMIT' || this.status === 429;
  }

  isSystemBusy() {
    return this.type === 'SYSTEM_BUSY' || this.status === 503;
  }
}

// Global instance for easy access
export const serverlessLLM = new ServerlessLLMClient();