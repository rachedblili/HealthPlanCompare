// Vercel serverless function for generating plan summaries
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
    
    // Check rate limits (most generous for summaries)
    const rateLimitCheck = await checkRateLimit(clientIP, 'summary');
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        type: 'RATE_LIMIT',
        message: 'You have reached the summary generation limit. Please try again later.',
        resetTime: rateLimitCheck.resetTime,
        retryAfter: rateLimitCheck.retryAfter
      });
    }

    const { planData, provider = 'openai' } = req.body;
    
    if (!planData) {
      return res.status(400).json({ error: 'Plan data is required' });
    }

    // Record usage
    await recordUsage(clientIP, 'summary');

    // Create a prompt for plan summary
    const prompt = `Create a clear, user-friendly summary of this health insurance plan. Focus on what matters most to consumers.

Plan Data:
${JSON.stringify(planData, null, 2)}

Please provide a summary in the following JSON format:
{
  "overview": "Brief 2-3 sentence overview of the plan",
  "keyBenefits": [
    "Key benefit 1",
    "Key benefit 2", 
    "Key benefit 3"
  ],
  "costHighlights": {
    "monthlyPremium": "Human-readable premium info",
    "deductible": "Human-readable deductible info",
    "outOfPocketMax": "Human-readable OOP max info"
  },
  "bestFor": [
    "Type of person/family this plan works well for"
  ],
  "considerations": [
    "Important thing to consider about this plan"
  ],
  "networkInfo": "Brief note about network/provider access if relevant"
}

Make it conversational and easy to understand. Avoid insurance jargon where possible.`;

    // Call LLM API
    const summary = await callLLMAPI(provider, prompt);
    
    // Parse the JSON response
    let summaryData;
    try {
      summaryData = JSON.parse(summary);
    } catch (parseError) {
      // Fallback: try to extract JSON from response
      const jsonMatch = summary.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse summary from AI response');
      }
    }

    return res.status(200).json({
      success: true,
      data: summaryData,
      usage: {
        remaining: rateLimitCheck.remaining,
        resetTime: rateLimitCheck.resetTime
      }
    });

  } catch (error) {
    console.error('Summary Generation Error:', error);
    
    return res.status(500).json({
      error: 'Summary generation failed',
      type: 'PROCESSING_ERROR',
      message: 'We encountered an error generating the plan summary. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}