// Vercel serverless function for generating plan comparison insights
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
    
    // Check rate limits (more generous for insights since they're less expensive)
    const rateLimitCheck = await checkRateLimit(clientIP, 'insights');
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        type: 'RATE_LIMIT',
        message: 'You have reached the insights generation limit. Please try again later.',
        resetTime: rateLimitCheck.resetTime,
        retryAfter: rateLimitCheck.retryAfter
      });
    }

    const { plans, familyData, calculationResults, provider = 'openai' } = req.body;
    
    if (!plans || !familyData || !calculationResults) {
      return res.status(400).json({ error: 'Plans, family data, and calculation results are required' });
    }

    // Record usage
    await recordUsage(clientIP, 'insights');

    // Create a comprehensive prompt for insights
    const prompt = `As a healthcare cost analysis expert, provide personalized insights for this family's health plan comparison.

Family Profile:
${JSON.stringify(familyData, null, 2)}

Available Plans:
${JSON.stringify(plans, null, 2)}

Cost Analysis Results:
${JSON.stringify(calculationResults, null, 2)}

Please provide insights in the following JSON format:
{
  "keyFindings": [
    "Brief finding 1",
    "Brief finding 2",
    "Brief finding 3"
  ],
  "bestPlanOverall": {
    "planName": "Plan name",
    "reason": "Why this plan is best overall"
  },
  "costSavingsOpportunities": [
    "Specific opportunity 1",
    "Specific opportunity 2"
  ],
  "riskConsiderations": [
    "Risk factor 1",
    "Risk factor 2"
  ],
  "familySpecificAdvice": "Personalized advice based on family's usage patterns",
  "scenarioAnalysis": {
    "lowUsage": "What happens if family uses less healthcare",
    "highUsage": "What happens if family has unexpected high usage"
  }
}

Focus on actionable insights and avoid generic advice. Consider the family's specific medical needs, usage patterns, and financial situation.`;

    // Call LLM API
    const insights = await callLLMAPI(provider, prompt);
    
    // Parse the JSON response
    let insightsData;
    try {
      insightsData = JSON.parse(insights);
    } catch (parseError) {
      // Fallback: try to extract JSON from response
      const jsonMatch = insights.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insightsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse insights from AI response');
      }
    }

    return res.status(200).json({
      success: true,
      data: insightsData,
      usage: {
        remaining: rateLimitCheck.remaining,
        resetTime: rateLimitCheck.resetTime
      }
    });

  } catch (error) {
    console.error('Insights Generation Error:', error);
    
    return res.status(500).json({
      error: 'Insights generation failed',
      type: 'PROCESSING_ERROR',
      message: 'We encountered an error generating insights. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}