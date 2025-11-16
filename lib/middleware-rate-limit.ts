import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from './rate-limit';

/**
 * Rate limiting middleware wrapper
 * Use this to protect API routes
 */
export async function withRateLimit(
  request: NextRequest,
  options: {
    limit: number;
    window: number;
    endpoint?: string;
  },
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const clientIP = getClientIP(request);
  const endpoint = options.endpoint || request.nextUrl.pathname;

  const rateLimit = await checkRateLimit({
    identifier: clientIP,
    endpoint,
    limit: options.limit,
    window: options.window,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': options.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        },
      }
    );
  }

  // Add rate limit headers to response
  const response = await handler(request);
  response.headers.set('X-RateLimit-Limit', options.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimit.resetAt.toISOString());

  return response;
}

