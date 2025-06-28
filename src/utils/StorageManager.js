// Local storage management for persisting user data
export class StorageManager {
  static STORAGE_KEYS = {
    PLANS: 'healthPlanComparison_plans',
    FAMILY: 'healthPlanComparison_family',
    SETTINGS: 'healthPlanComparison_settings'
  };

  static async init() {
    // Check if localStorage is available
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch (error) {
      console.warn('localStorage not available, data will not persist');
    }
  }

  static savePlans(plans) {
    try {
      // Check if data has actually changed to avoid unnecessary writes
      const currentData = localStorage.getItem(this.STORAGE_KEYS.PLANS);
      const newData = JSON.stringify(plans);
      
      if (currentData !== newData) {
        localStorage.setItem(this.STORAGE_KEYS.PLANS, newData);
      }
    } catch (error) {
      console.warn('Failed to save plans:', error);
      // If localStorage is full, try to clear old data
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data');
        try {
          localStorage.removeItem(this.STORAGE_KEYS.PLANS);
          localStorage.setItem(this.STORAGE_KEYS.PLANS, JSON.stringify(plans));
        } catch (retryError) {
          console.error('Failed to save plans after clearing storage:', retryError);
        }
      }
    }
  }

  static loadPlans() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.PLANS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('Failed to load plans:', error);
      return [];
    }
  }

  static saveFamilyData(familyData) {
    try {
      // Check if data has actually changed to avoid unnecessary writes
      const currentData = localStorage.getItem(this.STORAGE_KEYS.FAMILY);
      const newData = JSON.stringify(familyData);
      
      if (currentData !== newData) {
        localStorage.setItem(this.STORAGE_KEYS.FAMILY, newData);
      }
    } catch (error) {
      console.warn('Failed to save family data:', error);
      // If localStorage is full, try to clear old data
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data');
        try {
          localStorage.removeItem(this.STORAGE_KEYS.FAMILY);
          localStorage.setItem(this.STORAGE_KEYS.FAMILY, JSON.stringify(familyData));
        } catch (retryError) {
          console.error('Failed to save family data after clearing storage:', retryError);
        }
      }
    }
  }

  static loadFamilyData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.FAMILY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to load family data:', error);
      return null;
    }
  }

  static saveSettings(settings) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }

  static loadSettings() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.warn('Failed to load settings:', error);
      return {};
    }
  }

  static clearAll() {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn('Failed to clear storage:', error);
    }
  }

  static exportData() {
    return {
      plans: this.loadPlans(),
      family: this.loadFamilyData(),
      settings: this.loadSettings(),
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
  }

  static importData(data) {
    try {
      if (data.plans) this.savePlans(data.plans);
      if (data.family) this.saveFamilyData(data.family);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
}