// Configuration Loader - reads from .env file for local development
export class ConfigLoader {
  static async loadConfig() {
    try {
      const response = await fetch('/.env');
      if (!response.ok) {
        console.log('No .env file found, using default server mode');
        return {};
      }
      
      const envText = await response.text();
      return this.parseEnvFile(envText);
    } catch (error) {
      console.log('Could not load .env file:', error.message);
      return {};
    }
  }

  static parseEnvFile(envText) {
    const config = {};
    
    const lines = envText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // Parse KEY=VALUE
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        continue;
      }
      
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();
      
      config[key] = value;
    }
    
    return config;
  }

  static async getConfig() {
    const envConfig = await this.loadConfig();
    
    return {
      // LLM Mode Configuration - SECURITY CRITICAL
      llmMode: envConfig.LLM_MODE || 'server', // 'server' | 'local' | 'hybrid'
      enableLocalLLM: envConfig.ENABLE_LOCAL_LLM === 'true', // Default false for security
      
      // Local LLM Settings (only used in local/hybrid mode)
      defaultProvider: envConfig.DEFAULT_LLM_PROVIDER || 'openai',
      openaiModel: envConfig.DEFAULT_OPENAI_MODEL || 'gpt-4o-mini',
      anthropicModel: envConfig.DEFAULT_ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      openaiApiKey: envConfig.OPENAI_API_KEY,
      anthropicApiKey: envConfig.ANTHROPIC_API_KEY,
      temperature: envConfig.LLM_TEMPERATURE ? parseFloat(envConfig.LLM_TEMPERATURE) : 0.3,
      maxTokens: envConfig.LLM_MAX_TOKENS ? parseInt(envConfig.LLM_MAX_TOKENS) : 2000,
      
      // Legacy settings
      enableLLM: envConfig.ENABLE_LLM !== 'false',
      autoOfferLLM: envConfig.AUTO_OFFER_LLM !== 'false',
    };
  }

  // Get the configured LLM mode with security-first defaults
  static async getLLMMode() {
    const config = await this.getConfig();
    
    // Always default to server mode for security
    if (!config.enableLocalLLM) {
      return 'server';
    }
    
    return config.llmMode;
  }

  // Check if local LLM features should be available
  static async isLocalLLMEnabled() {
    const config = await this.getConfig();
    const mode = await this.getLLMMode();
    
    return config.enableLocalLLM && (mode === 'local' || mode === 'hybrid');
  }

  // Check if server LLM features should be available  
  static async isServerLLMEnabled() {
    const mode = await this.getLLMMode();
    return mode === 'server' || mode === 'hybrid';
  }
}