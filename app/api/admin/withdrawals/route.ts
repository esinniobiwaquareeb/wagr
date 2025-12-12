import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/withdrawals
 * Get all withdrawals (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = new URLSearchParams();
    if (searchParams.get('status')) queryParams.set('status', searchParams.get('status')!);
    if (searchParams.get('userId')) queryParams.set('userId', searchParams.get('userId')!);
    if (searchParams.get('limit')) queryParams.set('limit', searchParams.get('limit')!);
    if (searchParams.get('offset')) queryParams.set('offset', searchParams.get('offset')!);

    const query = queryParams.toString();

    // Call NestJS backend to get withdrawals
    const response = await nestjsServerFetch<{ withdrawals: any[] }>(`/admin/withdrawals${query ? `?${query}` : ''}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch withdrawals');
    }

    return successResponseNext({
      withdrawals: response.data.withdrawals || [],
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
