// Configuration Utility
// Loads configuration from .env file

import { ConfigLoader } from './ConfigLoader.js';

export class EnvConfig {
  static async getConfig() {
    return await ConfigLoader.getConfig();
  }

  static async getDefaultApiKey(provider) {
    const config = await this.getConfig();
    return provider === 'openai' ? config.openaiApiKey : config.anthropicApiKey;
  }

  static async getDefaultModel(provider) {
    const config = await this.getConfig();
    return provider === 'openai' ? config.openaiModel : config.anthropicModel;
  }

  static async isLLMEnabled() {
    const config = await this.getConfig();
    return config.enableLLM;
  }

  static async shouldAutoOfferLLM() {
    const config = await this.getConfig();
    return config.autoOfferLLM;
  }

  // Check if system has default API keys configured
  static async hasSystemApiKeys() {
    const config = await this.getConfig();
    return !!(config.openaiApiKey || config.anthropicApiKey);
  }

  // Get the best available configuration (system defaults + user overrides)
  static async getBestConfig() {
    const config = await this.getConfig();
    
    // Check for user-stored configuration first
    const userProvider = localStorage.getItem('llm_provider');
    const userApiKey = localStorage.getItem('llm_api_key');
    
    // Determine which provider and key to use
    let provider, apiKey;
    
    if (userApiKey && userProvider) {
      // User has their own configuration
      provider = userProvider;
      apiKey = userApiKey;
    } else if (config.defaultProvider === 'openai' && config.openaiApiKey) {
      // Use system OpenAI default
      provider = 'openai';
      apiKey = config.openaiApiKey;
    } else if (config.defaultProvider === 'anthropic' && config.anthropicApiKey) {
      // Use system Anthropic default  
      provider = 'anthropic';
      apiKey = config.anthropicApiKey;
    } else if (config.openaiApiKey) {
      // Fallback to any available system key
      provider = 'openai';
      apiKey = config.openaiApiKey;
    } else if (config.anthropicApiKey) {
      provider = 'anthropic';
      apiKey = config.anthropicApiKey;
    } else {
      // No API keys available
      return null;
    }

    return {
      provider,
      apiKey,
      model: await this.getDefaultModel(provider),
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      isSystemDefault: !userApiKey
    };
  }

  // Development/debugging helper
  static async logConfig() {
    const config = await this.getConfig();
    console.log('🔧 Configuration loaded from .env:', {
      ...config,
      // Mask API keys for security
      openaiApiKey: config.openaiApiKey ? `${config.openaiApiKey.substring(0, 8)}...` : 'Not set',
      anthropicApiKey: config.anthropicApiKey ? `${config.anthropicApiKey.substring(0, 8)}...` : 'Not set'
    });
  }
}