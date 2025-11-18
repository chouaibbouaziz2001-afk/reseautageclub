import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];

  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => rateLimitStore.delete(key));
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware for API routes
 * @param identifier - User ID or IP address
 * @param config - Rate limit configuration
 * @returns true if rate limit exceeded
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }
): { limited: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record) {
    // First request
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { limited: false, remaining: config.maxRequests - 1, resetTime };
  }

  if (now > record.resetTime) {
    // Window expired, reset
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { limited: false, remaining: config.maxRequests - 1, resetTime };
  }

  if (record.count >= config.maxRequests) {
    // Rate limit exceeded
    return { limited: true, remaining: 0, resetTime: record.resetTime };
  }

  // Increment counter
  record.count++;
  return {
    limited: false,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (real) {
    return real.trim();
  }

  return 'unknown';
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Authentication
  auth: { maxRequests: 5, windowMs: 60000 }, // 5 per minute

  // Post creation
  createPost: { maxRequests: 10, windowMs: 60000 }, // 10 per minute

  // Messages
  sendMessage: { maxRequests: 20, windowMs: 60000 }, // 20 per minute

  // File uploads
  upload: { maxRequests: 10, windowMs: 60000 }, // 10 per minute

  // General API
  api: { maxRequests: 60, windowMs: 60000 }, // 60 per minute

  // Search queries
  search: { maxRequests: 30, windowMs: 60000 }, // 30 per minute
};

/**
 * Create rate limit response
 */
export function createRateLimitResponse(resetTime: number): NextResponse {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      },
    }
  );
}
