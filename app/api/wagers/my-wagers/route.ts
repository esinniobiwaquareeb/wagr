import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/wagers/my-wagers
 * Get wagers that the current user created or participated in
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();

    // Call NestJS backend to get user's wagers
    // Backend returns: { success: true, data: [...wagers], meta: {...} }
    const response = await nestjsServerFetch<any>(`/wagers/my-wagers?${searchParams}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch user wagers');
    }

    // Backend returns data as an array of wagers directly
    const wagers = Array.isArray(response.data) ? response.data : [];
    const meta = (response as any).meta;

    return successResponseNext(
      { wagers },
      meta
    );
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

