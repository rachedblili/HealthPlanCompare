# Deployment Guide - Health Plan Comparison Tool

This guide explains how to deploy the Health Plan Comparison Tool with secure serverless API functions.

## Architecture Overview

- **Frontend**: Static client-side application (Vanilla JS + Tailwind CSS)
- **Backend**: Vercel serverless functions for LLM API calls
- **Deployment**: Vercel with built-in rate limiting and usage monitoring

## Pre-Deployment Setup

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Configure Environment Variables
You'll need API keys from OpenAI and/or Anthropic:

**OpenAI API Key:**
- Go to https://platform.openai.com/api-keys
- Create a new API key
- Set usage limits to control costs

**Anthropic API Key:**
- Go to https://console.anthropic.com/
- Create a new API key
- Set usage limits to control costs

### 3. Set Up Vercel Project
```bash
# Login to Vercel
vercel login

# Initialize project (run from project root)
vercel

# Set environment variables in Vercel dashboard or CLI
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
```

## Deployment Steps

### 1. Deploy to Vercel
```bash
# Deploy to production
vercel --prod

# Or deploy preview
vercel
```

### 2. Configure Environment Variables in Vercel Dashboard

Go to your Vercel project dashboard → Settings → Environment Variables:

**Required Variables:**
- `OPENAI_API_KEY`: Your OpenAI API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key

**Optional Variables:**
- `DEFAULT_OPENAI_MODEL`: Default model (default: gpt-4o-mini)
- `DEFAULT_ANTHROPIC_MODEL`: Default model (default: claude-3-haiku-20240307)
- `NODE_ENV`: Set to "production"

### 3. Test Deployment

Visit your deployed URL and:
1. Upload a test PDF
2. Verify AI analysis works
3. Check rate limiting by making multiple requests
4. Monitor logs in Vercel dashboard

## Rate Limiting Configuration

The system includes built-in protection:

### Current Limits (per IP address):
- **PDF Analysis**: 5 requests per hour
- **Insights Generation**: 10 requests per hour  
- **Summary Generation**: 15 requests per hour
- **Daily Budget**: 10 cost units per IP per day
- **Global Daily Budget**: 1000 cost units total

### Cost Weights:
- PDF Analysis: 1.0 units
- Insights: 0.5 units
- Summaries: 0.3 units

### Customizing Limits

Edit `api/utils/rateLimiter.js`:

```javascript
const RATE_LIMITS = {
  'pdf-analysis': {
    requests: 5,      // Requests per window
    windowMs: 3600000, // 1 hour window
    cost: 1           // Cost weight
  }
  // ... other limits
};

const DAILY_BUDGET = {
  perIP: 10,        // Per IP daily budget
  global: 1000      // Global daily budget
};
```

## Cost Management

### Setting API Key Limits
- **OpenAI**: Set monthly spending limits in OpenAI dashboard
- **Anthropic**: Set usage limits in Anthropic console

### Monitoring Usage
- Check Vercel function logs
- Monitor API provider usage dashboards
- Set up Vercel spending alerts

### Emergency Shutdown
If costs spike unexpectedly:
1. Remove environment variables in Vercel dashboard
2. Functions will gracefully fail without exposing errors
3. App falls back to regex-only PDF analysis

## Custom Domain (Optional)

### 1. Add Domain in Vercel
- Go to Project Settings → Domains
- Add your custom domain
- Configure DNS records

### 2. Update CORS if Needed
If using custom domain, update CORS headers in API functions:
```javascript
res.setHeader('Access-Control-Allow-Origin', 'https://yourapp.com');
```

## Production Optimization

### 1. Enable Vercel KV for Better Rate Limiting
```bash
# Add Vercel KV database
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN
```

Update `api/utils/rateLimiter.js` to use KV instead of memory store.

### 2. Add Monitoring
```javascript
// Add to API functions for monitoring
console.log('API call:', {
  operation: 'pdf-analysis',
  ip: clientIP,
  timestamp: new Date().toISOString()
});
```

### 3. Implement Circuit Breaker
Add system load detection in `api/utils/rateLimiter.js`:
```javascript
// Check system health before processing
if (systemLoad > 0.8) {
  return res.status(503).json({
    error: 'System busy',
    type: 'SYSTEM_BUSY'
  });
}
```

## Troubleshooting

### Common Issues:

**1. Environment Variables Not Found**
- Verify variables are set in Vercel dashboard
- Redeploy after adding variables

**2. CORS Errors**
- Check CORS headers in API functions
- Verify domain matches frontend URL

**3. Rate Limiting Too Strict**
- Adjust limits in `rateLimiter.js`
- Consider user authentication for higher limits

**4. High Costs**
- Lower daily budgets
- Use cheaper models (gpt-4o-mini, claude-haiku)
- Implement stricter rate limits

### Checking Logs:
```bash
# View function logs
vercel logs

# Real-time logs  
vercel logs --follow
```

## Security Considerations

1. **API Keys**: Never expose in client-side code
2. **Rate Limiting**: Prevents abuse and cost overruns
3. **Input Validation**: All inputs are validated before processing
4. **Error Handling**: Errors don't expose sensitive information
5. **CORS**: Configured for your domain only

## Scaling

The serverless architecture automatically scales with demand:
- Functions scale to zero when not used (no cost)
- Automatically handles traffic spikes
- Built-in DDoS protection via Vercel
- Global CDN for fast static asset delivery

For high-volume usage, consider:
- Upgrading to Vercel Pro for higher limits
- Implementing user authentication for personalized rate limits
- Adding premium tiers with higher usage allowances