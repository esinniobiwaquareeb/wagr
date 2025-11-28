import { NextRequest } from 'next/server';
import { testRedisConnection } from '@/lib/redis/test';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/test-redis
 * Test Redis connection and functionality
 */
export async function GET(request: NextRequest) {
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

