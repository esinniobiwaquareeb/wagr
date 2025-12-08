// Simple in-memory rate limiting (for Next.js API routes)
// Note: NestJS backend has its own throttling, this is just for Next.js API routes

interface RateLimitOptions {
  identifier: string; // user_id or ip_address
  endpoint: string;
  limit: number; // requests per window
  window: number; // window in seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// In-memory store (cleared on server restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiting utility
 * For production, rate limiting should be handled by NestJS backend throttling
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { identifier, endpoint, limit, window } = options;
  
  const now = Date.now();
  const key = `${identifier}:${endpoint}`;
  const windowMs = window * 1000;
  
  // Clean up old entries periodically (every 1000 calls)
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    // New window or expired entry
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(resetAt),
    };
  }
  
  if (entry.count >= limit) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Try various headers (for proxies, load balancers, etc.)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

