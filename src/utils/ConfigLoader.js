// Configuration Loader - reads from .env file
export class ConfigLoader {
  static async loadConfig() {
    try {
      const response = await fetch('/.env');
      if (!response.ok) {
        console.log('No .env file found, using user-provided configuration only');
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
      defaultProvider: envConfig.DEFAULT_LLM_PROVIDER,
      openaiModel: envConfig.DEFAULT_OPENAI_MODEL,
      anthropicModel: envConfig.DEFAULT_ANTHROPIC_MODEL,
      openaiApiKey: envConfig.OPENAI_API_KEY,
      anthropicApiKey: envConfig.ANTHROPIC_API_KEY,
      temperature: envConfig.LLM_TEMPERATURE ? parseFloat(envConfig.LLM_TEMPERATURE) : undefined,
      maxTokens: envConfig.LLM_MAX_TOKENS ? parseInt(envConfig.LLM_MAX_TOKENS) : undefined,
      enableLLM: envConfig.ENABLE_LLM !== 'false',
      autoOfferLLM: envConfig.AUTO_OFFER_LLM !== 'false',
    };
  }
}