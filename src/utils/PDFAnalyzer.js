// PDF Analysis utility for extracting health plan data from SBC documents
import { serverlessLLM } from './ServerlessLLMClient.js';

export class PDFAnalyzer {
  constructor() {
    this.isInitialized = false;
    // LLM functionality moved to server-side
  }


  async init() {
    if (this.isInitialized) return;
    
    try {
      // Load PDF.js library dynamically
      await this.loadPDFJS();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize PDF.js:', error);
      throw new Error('PDF analysis not available');
    }
  }

  async loadPDFJS() {
    // Load PDF.js from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('PDF.js load timeout'));
      }, 15000); // 15 second timeout
      
      script.onload = () => {
        clearTimeout(timeout);
        try {
          // Set worker source
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          console.log('PDF.js loaded successfully');
          resolve();
        } catch (error) {
          console.error('PDF.js worker setup failed:', error);
          reject(error);
        }
      };
      
      script.onerror = (error) => {
        clearTimeout(timeout);
        console.error('PDF.js failed to load:', error);
        reject(error);
      };
      
      document.head.appendChild(script);
    });
  }

  async analyzeSBC(file, progressCallback = null) {
    await this.init();
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PDF processing timeout')), 30000); // 30 second timeout
      });
      
      const analysisPromise = (async () => {
        if (progressCallback) progressCallback('Extracting text from PDF...');
        
        const text = await this.extractTextFromPDF(file, (page, total) => {
          if (progressCallback) {
            progressCallback(`Processing page ${page} of ${total}...`);
          }
        });
        
        if (progressCallback) progressCallback('Analyzing extracted text...');
        
        // Check if we got meaningful text
        if (!text || text.trim().length < 100) {
          throw new Error('PDF appears to be empty or contains no readable text');
        }
        
        const planData = await this.parseSBCText(text, file.name || fileName);
        
        if (progressCallback) progressCallback('Analysis complete!');
        
        return planData;
      })();
      
      return await Promise.race([analysisPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('PDF analysis error:', error);
      throw error;
    }
  }

  async extractTextFromPDF(file, progressCallback = null) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 50); // Limit to 50 pages for performance
    
    for (let i = 1; i <= maxPages; i++) {
      // Update progress
      if (progressCallback) {
        progressCallback(i, maxPages);
      }
      
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
        
        // Yield control to prevent UI blocking
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
      } catch (error) {
        console.warn(`Error processing page ${i}:`, error);
        continue; // Skip problematic pages
      }
    }
    
    return fullText;
  }

  async parseSBCText(text, fileName = 'SBC Document') {
    console.log('📋 Starting SBC text parsing...');
    
    let llmData = null;
    let regexData = null;

    // Try serverless LLM analysis first
    console.log('🤖 Using serverless LLM-enhanced analysis...');
    try {
      const result = await serverlessLLM.analyzePDF(text, {
        provider: 'openai',
        showProgress: (message, type) => {
          console.log(`📋 ${message}`);
          // You could emit events here to update UI progress
        }
      });
      
      if (result && result.success) {
        llmData = result.data;
        console.log('✅ Serverless LLM analysis successful');
      }
    } catch (error) {
      console.warn('🤖 Serverless LLM analysis failed, falling back to regex:', error.message);
      
      console.warn('🤖 Serverless LLM analysis failed, using regex only:', error.message);
    }

    // Always run regex-based extraction as backup/validation
    console.log('🔍 Running regex-based extraction...');
    regexData = this.extractWithRegex(text);

    // Combine results, preferring LLM data but filling gaps with regex
    const combinedData = this.combineExtractionResults(llmData, regexData);
    
    console.log('✅ SBC parsing complete');
    return this.cleanPlanData(combinedData);
  }

  extractWithRegex(text) {
    // Original regex-based extraction logic
    return {
      name: this.extractPlanName(text),
      insurer: this.extractInsurer(text),
      planType: this.extractPlanType(text),
      monthlyPremium: this.extractMonthlyPremium(text),
      individualDeductible: this.extractIndividualDeductible(text),
      familyDeductible: this.extractFamilyDeductible(text),
      individualOOPMax: this.extractIndividualOOPMax(text),
      familyOOPMax: this.extractFamilyOOPMax(text),
      primaryCopay: this.extractPrimaryCopay(text),
      specialistCopay: this.extractSpecialistCopay(text),
      coinsurance: this.extractCoinsurance(text),
      rxDeductible: this.extractRxDeductible(text),
      tier1DrugCost: this.extractTier1DrugCost(text),
      tier2DrugCost: this.extractTier2DrugCost(text),
      tier3DrugCost: this.extractTier3DrugCost(text),
      specialtyDrugCost: this.extractSpecialtyDrugCost(text),
      hsaEligible: this.checkHSAEligibility(text),
      networkType: this.extractNetworkType(text),
      year: this.extractPlanYear(text),
      extractionMethod: 'regex'
    };
  }

  combineExtractionResults(llmData, regexData) {
    // If no LLM data, use regex data
    if (!llmData) {
      return { ...regexData, extractionMethod: 'regex' };
    }

    // Combine both, preferring LLM data but using regex as fallback
    const combined = { ...regexData };
    
    // Override with LLM data where available and valid
    Object.keys(llmData).forEach(key => {
      if (llmData[key] !== null && llmData[key] !== undefined && llmData[key] !== '') {
        // Handle field name mapping - LLM uses 'planName' but we store as 'name'
        const targetKey = key === 'planName' ? 'name' : key;
        const regexFallback = targetKey === 'name' ? regexData.name : regexData[key];
        
        const cleanedValue = this.validateAndCleanField(key, llmData[key], regexFallback);
        if (cleanedValue !== null) {
          combined[targetKey] = cleanedValue;
        }
        // If validation fails, keep the regex value
      }
    });

    // Add extraction metadata
    combined.extractionMethod = 'hybrid';
    combined.llmQuality = llmData.extractionQuality || 'UNKNOWN';
    combined.llmNotes = llmData.notes;
    combined.llmMissingFields = llmData.missingFields;

    return combined;
  }

  validateAndCleanField(fieldName, llmValue, regexValue) {
    if (typeof llmValue !== 'string') {
      return llmValue; // Return numbers, booleans as-is
    }

    const value = llmValue.trim();

    // For critical display fields, validate they're reasonable
    if (fieldName === 'name' || fieldName === 'planName') {
      // Reject if it looks like document boilerplate
      if (this.looksLikeBoilerplate(value)) {
        console.warn(`❌ Rejecting plan name that looks like boilerplate (length: ${value.length}), using regex fallback`);
        return regexValue; // Use regex fallback
      }
      
      // Extract just the plan name if it's embedded in longer text
      const extractedName = this.extractPlanNameFromText(value);
      console.log(`✅ Extracted clean plan name: "${extractedName}"`);
      return extractedName;
    }

    if (fieldName === 'insurer') {
      if (value.length > 100 || this.looksLikeBoilerplate(value)) {
        return regexValue; // Use regex fallback
      }
      return value.split('\n')[0].substring(0, 50); // First line, max 50 chars
    }

    return value;
  }

  looksLikeBoilerplate(text) {
    const boilerplateIndicators = [
      'Summary of Benefits and Coverage',
      'Coverage Period:',
      'This is only a summary',
      'For general definitions',
      'Important Questions',
      'What this Plan Covers',
      'Page 1 of',
      'https://'
    ];

    const hasIndicator = boilerplateIndicators.some(indicator => 
      text.includes(indicator)
    );
    
    const isTooLong = text.length > 200;
    
    return hasIndicator || isTooLong;
  }

  extractPlanNameFromText(text) {
    // Try to find the actual plan name in the text
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip obvious boilerplate lines
      if (this.looksLikeBoilerplate(trimmed)) {
        continue;
      }
      
      // Look for lines that contain plan-like patterns
      if (this.looksLikePlanName(trimmed)) {
        return trimmed.substring(0, 80); // Limit length
      }
    }
    
    // If nothing found, return first non-boilerplate line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 5 && trimmed.length < 100 && !this.looksLikeBoilerplate(trimmed)) {
        return trimmed;
      }
    }
    
    return 'Extracted Plan'; // Fallback
  }

  looksLikePlanName(text) {
    const planIndicators = [
      /\b(Gold|Silver|Bronze|Platinum)\b/i,
      /\b(PPO|HMO|EPO|HSA|HDHP)\b/i,
      /\b20\d{2}\b/, // Year
      /\bPlan\b/i
    ];

    return planIndicators.some(pattern => pattern.test(text)) && 
           text.length < 100 && 
           !this.looksLikeBoilerplate(text);
  }

  async offerLLMConfiguration() {
    // LLM configuration moved to server-side
    return false;
  }

  extractPlanName(text) {
    // Look for plan name patterns in SBC documents
    const patterns = [
      /Plan Name[:\s]+([^\n]+)/i,
      /Product Name[:\s]+([^\n]+)/i,
      /Coverage[:\s]+([^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  extractInsurer(text) {
    const patterns = [
      /Insurance Company[:\s]+([^\n]+)/i,
      /Insurer[:\s]+([^\n]+)/i,
      /Provided by[:\s]+([^\n]+)/i,
      /(Blue Cross|Aetna|Cigna|UnitedHealth|Kaiser|Anthem|Humana)[^\n]*/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] ? match[1].trim() : match[0].trim();
      }
    }

    return null;
  }

  extractPlanType(text) {
    const types = ['HMO', 'PPO', 'EPO', 'POS', 'HSA', 'HDHP'];
    
    for (const type of types) {
      if (text.toUpperCase().includes(type)) {
        return type;
      }
    }

    return null;
  }

  extractMonthlyPremium(text) {
    const patterns = [
      /Monthly Premium[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Premium[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractIndividualDeductible(text) {
    const patterns = [
      /Individual Deductible[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Deductible \(individual\)[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Annual Deductible[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractFamilyDeductible(text) {
    const patterns = [
      /Family Deductible[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Deductible \(family\)[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractIndividualOOPMax(text) {
    const patterns = [
      /Individual Out-of-Pocket Maximum[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Out-of-Pocket Maximum \(individual\)[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Maximum Out-of-Pocket[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractFamilyOOPMax(text) {
    const patterns = [
      /Family Out-of-Pocket Maximum[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Out-of-Pocket Maximum \(family\)[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractPrimaryCopay(text) {
    const patterns = [
      /Primary Care[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Primary Care Visit[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /PCP[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractSpecialistCopay(text) {
    const patterns = [
      /Specialist[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Specialist Visit[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractCoinsurance(text) {
    const patterns = [
      /Coinsurance[:\s]+([0-9]+)%/i,
      /You pay ([0-9]+)%/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]) / 100; // Convert percentage to decimal
      }
    }

    return null;
  }

  extractRxDeductible(text) {
    const patterns = [
      /Prescription Drug Deductible[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Rx Deductible[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Drug Deductible[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractTier1DrugCost(text) {
    const patterns = [
      /Tier 1[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Generic[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractTier2DrugCost(text) {
    const patterns = [
      /Tier 2[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Preferred Brand[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractTier3DrugCost(text) {
    const patterns = [
      /Tier 3[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Non-Preferred Brand[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i
    ];

    return this.extractCurrencyValue(text, patterns);
  }

  extractSpecialtyDrugCost(text) {
    // First try to extract dollar amounts - prioritize copay amounts over percentages
    const dollarPatterns = [
      /Tier 4[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Specialty[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /Specialty Drug[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
      // Handle complex formats like "25% coinsurance up to $250 copay per script"
      /up to \$([0-9,]+(?:\.[0-9]{2})?)\s+copay/i,
      /\$([0-9,]+(?:\.[0-9]{2})?)\s+copay/i,
      /copay.*?\$([0-9,]+(?:\.[0-9]{2})?)/i,
      // Handle "Retail: $250" or "Mail: $500" patterns
      /(?:Retail|Mail|Pharmacy)[:\s]+\$([0-9,]+(?:\.[0-9]{2})?)/i,
    ];

    const value = this.extractCurrencyValue(text, dollarPatterns);
    
    // Only fall back to percentage if no dollar amount is found
    if (!value) {
      const percentPatterns = [
        /Specialty[:\s]+([0-9]+)%/i,
        /Tier 4[:\s]+([0-9]+)%/i
      ];
      
      for (const pattern of percentPatterns) {
        const match = text.match(pattern);
        if (match) {
          return parseInt(match[1]) / 100; // Convert to decimal
        }
      }
    }

    return value;
  }

  checkHSAEligibility(text) {
    const hsaKeywords = ['HSA', 'Health Savings Account', 'High Deductible Health Plan', 'HDHP'];
    return hsaKeywords.some(keyword => text.toUpperCase().includes(keyword.toUpperCase()));
  }

  extractNetworkType(text) {
    const networkPatterns = [
      /Network[:\s]+([^\n]+)/i,
      /(In-Network|Out-of-Network)/i
    ];

    for (const pattern of networkPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  extractPlanYear(text) {
    const yearPattern = /(20[0-9]{2})/g;
    const years = text.match(yearPattern);
    
    if (years) {
      // Return the most recent year found
      return Math.max(...years.map(y => parseInt(y)));
    }

    return new Date().getFullYear();
  }

  extractCurrencyValue(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Remove commas and convert to number
        const value = match[1].replace(/,/g, '');
        const numValue = parseFloat(value);
        return isNaN(numValue) ? null : numValue;
      }
    }

    return null;
  }

  cleanPlanData(planData) {
    // Remove null values and ensure data types are correct
    const cleaned = {};
    
    for (const [key, value] of Object.entries(planData)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }

    // Set default values for essential fields
    if (!cleaned.monthlyPremium) cleaned.monthlyPremium = 0;
    if (!cleaned.individualDeductible) cleaned.individualDeductible = 0;
    if (!cleaned.familyDeductible) cleaned.familyDeductible = cleaned.individualDeductible * 2;
    if (!cleaned.individualOOPMax) cleaned.individualOOPMax = 0;
    if (!cleaned.familyOOPMax) cleaned.familyOOPMax = cleaned.individualOOPMax * 2;

    return cleaned;
  }

  // Utility method to validate extracted plan data
  validatePlanData(planData) {
    const required = ['name', 'monthlyPremium', 'individualDeductible', 'individualOOPMax'];
    const missing = required.filter(field => !planData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }
}
