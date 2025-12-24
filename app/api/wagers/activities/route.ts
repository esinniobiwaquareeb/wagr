import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/wagers/activities
 * Get platform activities (all wager activities)
 */
export async function GET(request: NextRequest) {
  try {
    const { page, limit } = getPaginationParams(request);
    
    // Get auth token from cookies (optional - activities may be public)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;
    
    // Call NestJS backend to get activities
    const response = await nestjsServerFetch<any>(`/wagers/activities?page=${page}&limit=${limit}`, {
      method: 'GET',
      token,
      requireAuth: false, // Public endpoint
    });

    // Log response structure for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      const { logger } = await import('@/lib/logger');
      logger.debug('Platform activities API response', {
        success: response.success,
        hasData: !!response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        error: response.error,
      });
    }

    if (!response.success) {
      const { logger } = await import('@/lib/logger');
      logger.error('Failed to fetch platform activities', {
        error: response.error,
      });
      return successResponseNext([], { total: 0, page: 1, limit });
    }

    if (!response.data) {
      return successResponseNext([], { total: 0, page: 1, limit });
    }

    // NestJS backend returns: { success: true, data: [...], meta: {...} }
    // nestjsServerFetch returns the response as-is, so response.data is the activities array
    let activities: any[] = [];
    let meta: any = {};

    // Check response structure
    if (Array.isArray(response.data)) {
      // Direct array: { success: true, data: [...] }
      activities = response.data;
      meta = (response as any).meta || {};
    } else if (response.data && typeof response.data === 'object') {
      // Nested structure: { success: true, data: { data: [...], meta: {...} } }
      if (Array.isArray(response.data.data)) {
        activities = response.data.data;
        meta = response.data.meta || {};
      } else if (Array.isArray(response.data.activities)) {
        activities = response.data.activities;
        meta = response.data.meta || {};
      }
    }

    // Return activities as array directly (not wrapped in object) to match frontend expectation
    return successResponseNext(activities, {
      page: meta.page || page,
      limit: meta.limit || limit,
      total: meta.total || 0,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

