// Local LLM Assistant for enhanced health plan analysis (local mode only)
import { EnvConfig } from './EnvConfig.js';

export class LLMAssistant {
  constructor() {
    this.apiKey = null;
    this.apiProvider = 'openai';
    this.model = null;
    this.temperature = 0.3;
    this.maxTokens = 2000;
    this.isConfigured = false;
    this.isSystemDefault = false;
    
    // Auto-configure with system defaults if available and in local mode
    this.autoConfigureFromEnv();
  }

  async autoConfigureFromEnv() {
    const isLocalEnabled = await EnvConfig.isLocalLLMEnabled();
    if (!isLocalEnabled) {
      console.log('🔒 Local LLM disabled - using server mode for security');
      return;
    }

    const bestConfig = await EnvConfig.getBestLocalConfig();
    if (bestConfig) {
      this.configure(
        bestConfig.apiKey, 
        bestConfig.provider, 
        bestConfig.model,
        bestConfig.temperature,
        bestConfig.maxTokens
      );
      this.isSystemDefault = bestConfig.isSystemDefault;
      
      if (bestConfig.isSystemDefault) {
        console.log(`🤖 Auto-configured local LLM with system defaults: ${bestConfig.provider} (${bestConfig.model})`);
      } else {
        console.log(`🤖 Auto-configured local LLM with user settings: ${bestConfig.provider} (${bestConfig.model})`);
      }
    }
  }

  configure(apiKey, provider, model, temperature, maxTokens) {
    this.apiKey = apiKey;
    this.apiProvider = provider;
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.isConfigured = !!apiKey;
    this.isSystemDefault = false;
  }

  async isAvailable() {
    const isLocalEnabled = await EnvConfig.isLocalLLMEnabled();
    return isLocalEnabled && this.isConfigured;
  }

  async analyzeSBCText(rawText, fileName) {
    if (!await this.isAvailable()) {
      console.log('Local LLM not available, falling back to server mode');
      return null;
    }

    try {
      const prompt = this.createSBCAnalysisPrompt(rawText, fileName);
      const response = await this.callLLM(prompt);
      return this.parseSBCResponse(response);
    } catch (error) {
      console.error('Local LLM analysis failed:', error);
      return null;
    }
  }

  createSBCAnalysisPrompt(rawText, fileName) {
    return `Please analyze this Summary of Benefits and Coverage (SBC) document and extract structured health plan information. 

IMPORTANT: SBC documents do NOT contain premium costs - those are set by employers. Do not extract or guess premium amounts.

Document: ${fileName}
Text Content:
${rawText}

Please extract the following information and return it as a JSON object:

{
  "planName": "Official plan name",
  "insurer": "Insurance company name", 
  "planType": "PPO/HMO/EPO/HSA/HDHP/POS",
  "year": "Plan year (number)",
  "deductible": {
    "individual": "Amount in dollars (number)",
    "family": "Amount in dollars (number)"
  },
  "outOfPocketMax": {
    "individual": "Individual out-of-pocket maximum (number)",
    "family": "Family out-of-pocket maximum (number)"
  },
  "copays": {
    "primaryCare": "Primary care copay amount (number)",
    "specialist": "Specialist copay amount (number)",
    "urgentCare": "Urgent care copay (number)",
    "emergencyRoom": "ER copay (number)"
  },
  "coinsurance": {
    "medical": "Medical coinsurance percentage as decimal (e.g., 0.20 for 20%)",
    "prescription": "Prescription coinsurance if different (number)"
  },
  "prescriptionTiers": {
    "tier1": {"type": "copay|coinsurance", "value": "number"},
    "tier2": {"type": "copay|coinsurance", "value": "number"},
    "tier3": {"type": "copay|coinsurance", "value": "number"},
    "tier4": {"type": "copay|coinsurance", "value": "number"}
  },
  "rxDeductible": "Prescription drug deductible if separate (number)",
  "hsaEligible": "Boolean - is this an HSA-eligible high deductible plan",
  "networkType": "In-network details",
  "summary": "A brief 2-3 sentence summary of the key plan features",
  "extractionQuality": "HIGH/MEDIUM/LOW based on how much data was found",
  "missingFields": ["Array of important fields that could not be extracted"],
  "notes": "Any important observations about the plan structure"
}

Rules:
- Return ONLY the JSON object, no other text
- Use null for fields that cannot be determined
- For drug costs, include both type (copay/coinsurance) and value
- Be conservative - only extract data you're confident about
- Do not guess or estimate premium costs
- Focus on benefit structure, not costs that vary by employer`;
  }

  async generatePlanSummary(planData, analysisNotes = null) {
    if (!await this.isAvailable()) return null;

    try {
      const prompt = `Create a clear, user-friendly summary of this health insurance plan. Focus on what matters most to families making decisions:

Plan Data:
${JSON.stringify(planData, null, 2)}

${analysisNotes ? `Additional Analysis Notes: ${analysisNotes}` : ''}

Please provide:

1. **Plan Overview** (2-3 sentences about plan type and key features)
2. **Cost Structure** (How deductibles, copays, and coinsurance work)  
3. **Best For** (What type of healthcare usage this plan suits)
4. **Key Considerations** (Important things to know)
5. **Missing Information** (What the user still needs to provide)

Write in clear, non-technical language that a family can easily understand. Focus on practical implications rather than insurance jargon.`;

      return await this.callLLM(prompt);
    } catch (error) {
      console.error('Plan summary generation failed:', error);
      return null;
    }
  }

  async generateComparisonInsights(allResults, familyData) {
    if (!await this.isAvailable()) return null;

    try {
      // Extract key plan comparison data
      const planSummary = Object.keys(allResults).map(planId => {
        const result = allResults[planId];
        return {
          name: result.planName,
          monthlyPremium: Math.round((result.annualPremium || 0) / 12),
          totalAnnualCost: Math.round(result.familyTotals?.totalWithPremiums || 0),
          outOfPocket: Math.round(result.familyTotals?.totalOutOfPocket || 0),
          coverageType: result.coverageType
        };
      }).sort((a, b) => a.totalAnnualCost - b.totalAnnualCost);

      const prompt = `Analyze these health plans for a family of ${familyData.members.length}:

${planSummary.map(plan => 
  `${plan.name}: $${plan.monthlyPremium}/mo premium, $${plan.totalAnnualCost} total annual cost`
).join('\n')}

Provide concise insights in this format:

**💡 Key Insights:** (50 words max)
[Which plan offers best value and why]

**🎯 Recommendations:** (50 words max)
[Specific advice about which plan to choose]

**⚠️ Important Considerations:** (50 words max)
[Key things this family should think about]

**🔮 Scenario Planning:** (50 words max)
[How choice might work out in different usage scenarios]

Keep each section under 50 words. Focus on practical, actionable advice.`;

      return await this.callLLM(prompt);
    } catch (error) {
      console.error('Comparison insights generation failed:', error);
      return null;
    }
  }

  async callLLM(prompt) {
    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        switch (this.apiProvider) {
          case 'openai':
            return await this.callOpenAI(prompt);
          case 'anthropic':
            return await this.callAnthropic(prompt);
          default:
            throw new Error(`Unsupported LLM provider: ${this.apiProvider}`);
        }
      } catch (error) {
        lastError = error;
        console.warn(`Local LLM call attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries - 1) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError;
  }

  async callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant specialized in health insurance analysis. Provide accurate, clear, and practical information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '';
  }

  async callAnthropic(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.temperature
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.content[0]?.text?.trim() || '';
  }

  parseSBCResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        
        // Validate the response has required fields
        if (parsed && typeof parsed === 'object') {
          return {
            ...parsed,
            llmAnalyzed: true,
            llmTimestamp: new Date().toISOString(),
            llmMode: 'local'
          };
        }
      }
      
      console.warn('Could not parse local LLM response as JSON:', response);
      return null;
    } catch (error) {
      console.error('Failed to parse local LLM response:', error);
      return null;
    }
  }

  // Configuration interface - only show in local mode
  static async showConfigurationModal() {
    const isLocalEnabled = await EnvConfig.isLocalLLMEnabled();
    if (!isLocalEnabled) {
      console.log('🔒 LLM configuration not available in server mode');
      return null;
    }

    const config = await EnvConfig.getConfig();
    const hasSystemDefaults = await EnvConfig.hasSystemApiKeys();
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">🤖 Configure Local AI Analysis</h3>
        
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-700">
            <strong>⚠️ Development Mode:</strong> This configuration exposes API keys in your browser. 
            Only use for local development, never on deployed websites.
          </p>
        </div>
        
        ${hasSystemDefaults ? `
          <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-sm text-green-700">
              <strong>✅ System defaults available:</strong> You can use pre-configured AI analysis 
              or override with your own API key for personalized settings.
            </p>
          </div>
        ` : `
          <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-700">
              <strong>Local Development:</strong> Add your OpenAI or Anthropic API key to get enhanced plan analysis, 
              better data extraction, and personalized insights.
            </p>
          </div>
        `}

        <form id="llm-config-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">API Provider</label>
            <select name="provider" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="openai" ${config.defaultProvider === 'openai' ? 'selected' : ''}>
                OpenAI (${config.openaiModel})
              </option>
              <option value="anthropic" ${config.defaultProvider === 'anthropic' ? 'selected' : ''}>
                Anthropic (${config.anthropicModel})
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              API Key ${hasSystemDefaults ? '(optional - leave blank to use system defaults)' : ''}
            </label>
            <input type="password" name="apiKey" 
                   class="w-full border border-gray-300 rounded-md px-3 py-2" 
                   placeholder="${hasSystemDefaults ? 'Leave blank for system defaults or enter your key' : 'sk-... or sk-ant-...'}">
            <p class="text-xs text-gray-500 mt-1">
              ${hasSystemDefaults ? 
                'Personal API keys override system defaults and are stored locally' : 
                'Your API key is stored locally in browser storage'
              }
            </p>
          </div>

          <div class="flex justify-between space-x-3 pt-4">
            <button type="button" class="px-4 py-2 text-gray-600 hover:text-gray-800" data-action="skip">
              ${hasSystemDefaults ? 'Use System Defaults' : 'Skip for Now'}
            </button>
            <button type="submit" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md">
              ${hasSystemDefaults ? 'Save Personal Settings' : 'Enable AI Analysis'}
            </button>
          </div>
        </form>
      </div>
    `;

    return new Promise((resolve) => {
      // Handle form submission
      modal.querySelector('#llm-config-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const apiKey = formData.get('apiKey').trim();
        const provider = formData.get('provider');
        
        if (apiKey) {
          // Store in localStorage for persistence
          localStorage.setItem('llm_api_key', apiKey);
          localStorage.setItem('llm_provider', provider);
          
          modal.remove();
          resolve({ apiKey, provider });
        } else if (hasSystemDefaults) {
          // Use system defaults
          modal.remove();
          resolve('system_defaults');
        }
      });

      // Handle skip
      modal.addEventListener('click', (e) => {
        if (e.target.matches('[data-action="skip"]') || e.target === modal) {
          modal.remove();
          // If system defaults available, use them
          if (hasSystemDefaults) {
            resolve('system_defaults');
          } else {
            resolve(null);
          }
        }
      });

      document.body.appendChild(modal);
      modal.querySelector('input[name="apiKey"]').focus();
    });
  }

  // Check for existing configuration
  static checkExistingConfig() {
    const apiKey = localStorage.getItem('llm_api_key');
    const provider = localStorage.getItem('llm_provider') || 'openai';
    
    if (apiKey) {
      return { apiKey, provider };
    }
    return null;
  }

  // Clear stored configuration
  static clearConfig() {
    localStorage.removeItem('llm_api_key');
    localStorage.removeItem('llm_provider');
  }
}