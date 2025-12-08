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
      return successResponseNext({ activities: [] });
    }

    // NestJS returns { success: true, data: [...], meta: {...} }
    const activities = Array.isArray(response.data) ? response.data : [];
    const meta = (response as any).meta;

    return successResponseNext({
      activities,
      meta,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

