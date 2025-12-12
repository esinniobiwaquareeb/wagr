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
 * GET /api/admin/transactions/[id]
 * Get transaction by ID (admin only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { id } = await params;

    // Call NestJS backend to get transaction
    const response = await nestjsServerFetch<{ transaction: any }>(`/admin/transactions/${id}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch transaction');
    }

    return successResponseNext({
      transaction: response.data.transaction,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
