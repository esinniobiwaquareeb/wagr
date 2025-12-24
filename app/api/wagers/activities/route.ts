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

    if (!response.success) {
      return successResponseNext([], { total: 0, page: 1, limit });
    }

    // NestJS returns { success: true, data: [...], meta: {...} }
    const activities = Array.isArray(response.data) ? response.data : [];
    const meta = (response as any).meta || {};

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

