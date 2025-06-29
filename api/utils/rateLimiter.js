// Rate limiting utilities for Vercel serverless functions
// Uses file-based storage in /tmp directory for persistence
import { promises as fs } from 'fs';

// Rate limiting configuration
const RATE_LIMITS = {
  'pdf-analysis': {
    requests: 5,      // 5 PDF analyses per window
    windowMs: 3600000, // 1 hour window
    cost: 1           // Cost weight for this operation
  },
  'insights': {
    requests: 10,     // 10 insights per window  
    windowMs: 3600000, // 1 hour window
    cost: 0.5         // Lower cost than PDF analysis
  },
  'summary': {
    requests: 15,     // 15 summaries per window
    windowMs: 3600000, // 1 hour window
    cost: 0.3         // Lowest cost operation
  }
};

// Daily budget limits (in "cost units")
const DAILY_BUDGET = {
  perIP: 10,        // Each IP gets 10 cost units per day
  global: 1000      // Global daily limit of 1000 cost units
};

export function getClientIP(req) {
  // Get real IP address from various headers (Vercel, Cloudflare, etc.)
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.headers['cf-connecting-ip'] ||
         req.connection?.remoteAddress ||
         'unknown';
}

export async function checkRateLimit(clientIP, operation) {
  const config = RATE_LIMITS[operation];
  if (!config) {
    throw new Error(`Unknown operation: ${operation}`);
  }

  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const dailyStart = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
  
  // Keys for tracking usage
  const hourlyKey = `rate_limit:${clientIP}:${operation}:${windowStart}`;
  const dailyKey = `daily_usage:${clientIP}:${dailyStart}`;
  const globalDailyKey = `global_daily:${dailyStart}`;

  try {
    // In a real implementation, this would use Vercel KV or Redis
    // For now, we'll use a simple in-memory store (not persistent across cold starts)
    const usage = await getCurrentUsage(hourlyKey, dailyKey, globalDailyKey);
    
    // Check hourly rate limit
    if (usage.hourly >= config.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + config.windowMs,
        retryAfter: Math.ceil((windowStart + config.windowMs - now) / 1000)
      };
    }

    // Check daily budget (per IP)
    const projectedDailyCost = usage.dailyIP + config.cost;
    if (projectedDailyCost > DAILY_BUDGET.perIP) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: dailyStart + (24 * 60 * 60 * 1000),
        retryAfter: Math.ceil((dailyStart + (24 * 60 * 60 * 1000) - now) / 1000),
        reason: 'Daily budget exceeded'
      };
    }

    // Check global daily budget
    const projectedGlobalCost = usage.globalDaily + config.cost;
    if (projectedGlobalCost > DAILY_BUDGET.global) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: dailyStart + (24 * 60 * 60 * 1000),
        retryAfter: Math.ceil((dailyStart + (24 * 60 * 60 * 1000) - now) / 1000),
        reason: 'Global daily budget exceeded'
      };
    }

    // Allow the request
    return {
      allowed: true,
      remaining: Math.min(
        config.requests - usage.hourly - 1,
        Math.floor((DAILY_BUDGET.perIP - projectedDailyCost) / config.cost)
      ),
      resetTime: windowStart + config.windowMs
    };

  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting system is down
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetTime: windowStart + config.windowMs
    };
  }
}

export async function recordUsage(clientIP, operation) {
  const config = RATE_LIMITS[operation];
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const dailyStart = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
  
  const hourlyKey = `rate_limit:${clientIP}:${operation}:${windowStart}`;
  const dailyKey = `daily_usage:${clientIP}:${dailyStart}`;
  const globalDailyKey = `global_daily:${dailyStart}`;

  try {
    // Record usage in all relevant buckets
    await incrementUsage(hourlyKey, config.windowMs);
    await incrementDailyUsage(dailyKey, config.cost, 24 * 60 * 60 * 1000);
    await incrementDailyUsage(globalDailyKey, config.cost, 24 * 60 * 60 * 1000);
    
    // Log usage for monitoring
    console.log(`Usage recorded: ${clientIP} -> ${operation} (cost: ${config.cost})`);
    
  } catch (error) {
    console.error('Failed to record usage:', error);
    // Continue anyway - don't fail the request due to logging issues
  }
}


const RATE_LIMIT_FILE = '/tmp/rate_limits.json';

// File-based persistent storage using /tmp directory
async function loadRateLimitData() {
  try {
    const data = await fs.readFile(RATE_LIMIT_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    // Clean expired entries
    const now = Date.now();
    const cleaned = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry.expires > now) {
        cleaned[key] = entry;
      }
    }
    
    return cleaned;
  } catch (error) {
    // File doesn't exist or is corrupted, return empty object
    return {};
  }
}

async function saveRateLimitData(data) {
  try {
    await fs.writeFile(RATE_LIMIT_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save rate limit data:', error);
    // Don't throw - we don't want to block requests due to storage issues
  }
}

async function getCurrentUsage(hourlyKey, dailyKey, globalDailyKey) {
  try {
    const data = await loadRateLimitData();
    
    return {
      hourly: data[hourlyKey]?.count || 0,
      dailyIP: data[dailyKey]?.count || 0,
      globalDaily: data[globalDailyKey]?.count || 0
    };
  } catch (error) {
    console.error('Failed to get current usage:', error);
    // Return zeros on error to be safe
    return { hourly: 0, dailyIP: 0, globalDaily: 0 };
  }
}

async function incrementUsage(key, ttlMs) {
  try {
    const data = await loadRateLimitData();
    const expires = Date.now() + ttlMs;
    
    data[key] = {
      count: (data[key]?.count || 0) + 1,
      expires: expires
    };
    
    await saveRateLimitData(data);
  } catch (error) {
    console.error('Failed to increment usage:', error);
    // Don't throw - we don't want to block requests due to storage issues
  }
}

async function incrementDailyUsage(key, cost, ttlMs) {
  try {
    const data = await loadRateLimitData();
    const expires = Date.now() + ttlMs;
    
    data[key] = {
      count: (data[key]?.count || 0) + cost,
      expires: expires
    };
    
    await saveRateLimitData(data);
  } catch (error) {
    console.error('Failed to increment daily usage:', error);
    // Don't throw - we don't want to block requests due to storage issues
  }
}

// File-based storage provides persistence across serverless function restarts
// Data stored in /tmp directory expires when the serverless environment is recycled
// This provides much better protection than in-memory storage