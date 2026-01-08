import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/ai-metrics
 * Get AI usage metrics and analytics
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_auth_token')?.value || cookieStore.get('auth_token')?.value || null;
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.set('startDate', startDate);
    if (endDate) queryParams.set('endDate', endDate);

    const queryString = queryParams.toString();
    const endpoint = `/admin/ai-metrics${queryString ? `?${queryString}` : ''}`;

    const response = await nestjsServerFetch(endpoint, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch AI metrics');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
