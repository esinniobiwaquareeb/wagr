import { createClient } from '@supabase/supabase-js';

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

/**
 * Rate limiting utility using database
 * For production, consider using Redis for better performance
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { identifier, endpoint, limit, window } = options;
  
  // Use service role for rate limiting (bypasses RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    // Fail open if not configured
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + window * 1000),
    };
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const queryWindowStart = new Date(now.getTime() - window * 1000);

  // Clean old records (async, don't wait)
  void supabase.rpc('clean_old_rate_limits');

  // Get current count for this identifier and endpoint
  const { data: rateLimits, error } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('identifier', identifier)
    .eq('endpoint', endpoint)
    .gte('window_start', queryWindowStart.toISOString())
    .order('window_start', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(now.getTime() + window * 1000),
    };
  }

  const currentWindow = rateLimits?.[0];
  const currentCount = currentWindow?.count || 0;

  if (currentCount >= limit) {
    // Rate limit exceeded
    const resetAt = currentWindow
      ? new Date(new Date(currentWindow.window_start).getTime() + window * 1000)
      : new Date(now.getTime() + window * 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Increment count or create new record
  // Calculate window start by rounding down to the nearest window boundary
  const windowStartMs = Math.floor(now.getTime() / (window * 1000)) * (window * 1000);
  const recordWindowStart = new Date(windowStartMs);
  const windowStartStr = recordWindowStart.toISOString();
  
  const { error: upsertError } = await supabase
    .from('rate_limits')
    .upsert({
      identifier,
      endpoint,
      count: currentCount + 1,
      window_start: windowStartStr,
    }, {
      onConflict: 'identifier,endpoint,window_start',
    });

  if (upsertError) {
    console.error('Rate limit upsert error:', upsertError);
  }

  return {
    allowed: true,
    remaining: limit - currentCount - 1,
    resetAt: new Date(now.getTime() + window * 1000),
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

