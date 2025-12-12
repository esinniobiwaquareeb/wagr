import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/withdrawals/[id]/reject
 * Reject a withdrawal (admin only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { id } = await params;

    // Call NestJS backend to reject withdrawal
    const response = await nestjsServerFetch<{ withdrawal: any; message: string }>(`/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to reject withdrawal');
    }

    return successResponseNext({
      withdrawal: response.data.withdrawal,
      message: response.data.message || 'Withdrawal rejected successfully',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
