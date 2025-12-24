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
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        dataKeys: response.data && typeof response.data === 'object' && !Array.isArray(response.data) ? Object.keys(response.data) : [],
        hasMeta: !!(response as any).meta,
        metaKeys: (response as any).meta ? Object.keys((response as any).meta) : [],
        error: response.error,
        fullResponse: JSON.stringify(response).substring(0, 1000),
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
    // nestjsServerFetch returns the response as-is, so:
    // - response.data = the activities array
    // - response.meta = the meta object (at top level)
    let activities: any[] = [];
    let meta: any = {};

    // Check response structure
    if (Array.isArray(response.data)) {
      // Direct array: { success: true, data: [...], meta: {...} }
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

    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      const { logger } = await import('@/lib/logger');
      logger.debug('Platform activities extracted', {
        activitiesCount: activities.length,
        hasMeta: !!meta,
        metaKeys: meta ? Object.keys(meta) : [],
      });
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

