// Rate limiting utilities for Vercel serverless functions
// Uses Vercel KV (Redis) for distributed rate limiting

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

// Simple in-memory store (replace with Vercel KV in production)
const memoryStore = new Map();

async function getCurrentUsage(hourlyKey, dailyKey, globalDailyKey) {
  // In production, replace with actual KV store calls
  return {
    hourly: memoryStore.get(hourlyKey) || 0,
    dailyIP: memoryStore.get(dailyKey) || 0,
    globalDaily: memoryStore.get(globalDailyKey) || 0
  };
}

async function incrementUsage(key, ttlMs) {
  const current = memoryStore.get(key) || 0;
  memoryStore.set(key, current + 1);
  
  // Set expiration (in production, KV store would handle this)
  setTimeout(() => {
    memoryStore.delete(key);
  }, ttlMs);
}

async function incrementDailyUsage(key, cost, ttlMs) {
  const current = memoryStore.get(key) || 0;
  memoryStore.set(key, current + cost);
  
  // Set expiration
  setTimeout(() => {
    memoryStore.delete(key);
  }, ttlMs);
}

// Production implementation would use Vercel KV:
/*
import { kv } from '@vercel/kv';

async function getCurrentUsage(hourlyKey, dailyKey, globalDailyKey) {
  const [hourly, dailyIP, globalDaily] = await Promise.all([
    kv.get(hourlyKey),
    kv.get(dailyKey), 
    kv.get(globalDailyKey)
  ]);
  
  return {
    hourly: hourly || 0,
    dailyIP: dailyIP || 0,
    globalDaily: globalDaily || 0
  };
}

async function incrementUsage(key, ttlMs) {
  await kv.incr(key);
  await kv.expire(key, Math.ceil(ttlMs / 1000));
}
*/