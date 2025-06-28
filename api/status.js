// System status endpoint for health checks
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if required environment variables are set
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    
    if (!hasOpenAI && !hasAnthropic) {
      return res.status(503).json({
        available: false,
        message: 'AI services are not configured',
        services: {
          openai: false,
          anthropic: false
        }
      });
    }

    // Simple health check
    const now = new Date();
    const currentHour = now.getHours();
    
    // Simulate different system states based on time
    const isPeakHour = currentHour >= 9 && currentHour <= 17;
    const isHighLoad = Math.random() < (isPeakHour ? 0.3 : 0.1);
    
    return res.status(200).json({
      available: true,
      message: isHighLoad ? 'System experiencing high load' : 'All systems operational',
      load: isHighLoad ? 'high' : 'normal',
      services: {
        openai: hasOpenAI,
        anthropic: hasAnthropic
      },
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('Status check failed:', error);
    
    return res.status(500).json({
      available: false,
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}