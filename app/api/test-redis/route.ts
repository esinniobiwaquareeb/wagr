import { NextRequest, NextResponse } from 'next/server';
import { testRedisConnection } from '@/lib/redis/test';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/test-redis
 * Test Redis connection and functionality
 * Disabled in production by default
 */
export async function GET(request: NextRequest) {
  // Disable in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TEST_ENDPOINTS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await testRedisConnection();
    
    if (result.success) {
      return successResponseNext({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } else {
      return appErrorToResponse(new Error(result.message));
    }
  } catch (error) {
    return appErrorToResponse(error as Error);
  }
}

