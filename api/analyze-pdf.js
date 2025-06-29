// Vercel serverless function for PDF analysis with rate limiting
import { getClientIP, checkRateLimit, recordUsage } from './utils/rateLimiter.js';
import { callLLMAPI } from './utils/llmClient.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientIP = getClientIP(req);
    
    // Check rate limits
    const rateLimitCheck = await checkRateLimit(clientIP, 'pdf-analysis');
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        type: 'RATE_LIMIT',
        message: 'You have reached the analysis limit. Please try again later.',
        resetTime: rateLimitCheck.resetTime,
        retryAfter: rateLimitCheck.retryAfter
      });
    }

    // Check system capacity
    const capacity = await checkSystemCapacity();
    if (!capacity.available) {
      return res.status(503).json({
        error: 'System busy',
        type: 'SYSTEM_BUSY',
        message: 'Our AI analysis system is currently at capacity. Please try again in a few minutes.',
        estimatedWaitTime: capacity.estimatedWaitTime
      });
    }

    const { pdfText, provider = 'openai' } = req.body;
    
    if (!pdfText) {
      return res.status(400).json({ error: 'PDF text is required' });
    }

    // Record usage before processing
    await recordUsage(clientIP, 'pdf-analysis');

    // Prepare the prompt for SBC analysis
    const prompt = `Analyze this Summary of Benefits and Coverage (SBC) document and extract the following health plan information in JSON format:

{
  "planName": "Plan Name",
  "planType": "HSA/PPO/HMO",
  "deductible": {
    "individual": number,
    "family": number
  },
  "outOfPocketMax": {
    "individual": number,
    "family": number
  },
  "copays": {
    "primaryCare": number,
    "specialist": number,
    "urgentCare": number,
    "emergencyRoom": number
  },
  "coinsurance": {
    "medical": number (as decimal, e.g., 0.2 for 20%),
    "prescription": number
  },
  "prescriptionTiers": {
    "tier1": {"type": "copay|coinsurance", "value": number},
    "tier2": {"type": "copay|coinsurance", "value": number},
    "tier3": {"type": "copay|coinsurance", "value": number},
    "tier4": {"type": "copay|coinsurance", "value": number}
  }
}

For prescription tiers:
- Use "copay" type for fixed dollar amounts (e.g., $50 copay) 
- Use "coinsurance" type for percentages (e.g., 20% coinsurance)
- For percentages, use decimal format (0.2 for 20%)
- If information is missing, use null.

SBC Document Text:
${pdfText}`;

    // Debug logging
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      keyLength: process.env.OPENAI_API_KEY?.length,
      model: process.env.DEFAULT_OPENAI_MODEL,
      provider
    });

    // Call LLM API
    const analysis = await callLLMAPI(provider, prompt);
    
    // Parse the JSON response
    let planData;
    try {
      planData = JSON.parse(analysis);
    } catch (parseError) {
      // Fallback: try to extract JSON from response
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        planData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse plan data from AI response');
      }
    }

    // Validate the extracted data
    if (!planData.planName) {
      throw new Error('Could not extract plan name from document');
    }

    return res.status(200).json({
      success: true,
      data: planData,
      usage: {
        remaining: rateLimitCheck.remaining,
        resetTime: rateLimitCheck.resetTime
      }
    });

  } catch (error) {
    console.error('PDF Analysis Error:', error);
    
    return res.status(500).json({
      error: 'Analysis failed',
      type: 'PROCESSING_ERROR',
      message: 'We encountered an error analyzing your document. Please try again or check if the document is a valid SBC.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Check system capacity based on current load
async function checkSystemCapacity() {
  // Simple capacity check - in production, this could check:
  // - Current active requests
  // - Response times
  // - Error rates
  // - Available compute resources
  
  const now = new Date();
  const currentHour = now.getHours();
  
  // Simulate peak hours (9 AM - 5 PM) having higher load
  const isPeakHour = currentHour >= 9 && currentHour <= 17;
  const baseCapacity = isPeakHour ? 0.8 : 0.95; // 80% or 95% available
  
  // Add some randomness to simulate real load
  const currentLoad = Math.random();
  const available = currentLoad < baseCapacity;
  
  return {
    available,
    estimatedWaitTime: available ? 0 : Math.floor(Math.random() * 300) + 60 // 1-5 minutes
  };
}