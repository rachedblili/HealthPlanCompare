// LLM client utilities for serverless functions
// Handles API calls to OpenAI and Anthropic with proper error handling

export async function callLLMAPI(provider, prompt, options = {}) {
  const {
    model = getDefaultModel(provider),
    temperature = 0.3,
    maxTokens = 2000
  } = options;

  if (provider === 'openai') {
    return await callOpenAI(prompt, model, temperature, maxTokens);
  } else if (provider === 'anthropic') {
    return await callAnthropic(prompt, model, temperature, maxTokens);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function callOpenAI(prompt, model, temperature, maxTokens) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a healthcare cost analysis expert. Provide accurate, helpful information about health insurance plans and costs. Always respond in valid JSON format when requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenAI API');
  }

  return data.choices[0].message.content;
}

async function callAnthropic(prompt, model, temperature, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      system: 'You are a healthcare cost analysis expert. Provide accurate, helpful information about health insurance plans and costs. Always respond in valid JSON format when requested.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.content || data.content.length === 0) {
    throw new Error('No response from Anthropic API');
  }

  return data.content[0].text;
}

function getDefaultModel(provider) {
  if (provider === 'openai') {
    return process.env.DEFAULT_OPENAI_MODEL || 'gpt-4o-mini';
  } else if (provider === 'anthropic') {
    return process.env.DEFAULT_ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
  }
  return null;
}

// Utility to estimate token usage for cost monitoring
export function estimateTokens(text) {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Utility to validate JSON responses
export function validateJSONResponse(response, requiredFields = []) {
  try {
    const parsed = JSON.parse(response);
    
    // Check for required fields
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error.message}`);
  }
}