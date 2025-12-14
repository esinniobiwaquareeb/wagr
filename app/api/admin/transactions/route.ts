import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/transactions
 * Get all transactions (admin only)
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
    if (searchParams.get('limit')) queryParams.set('limit', searchParams.get('limit')!);
    if (searchParams.get('offset')) queryParams.set('offset', searchParams.get('offset')!);
    if (searchParams.get('type')) queryParams.set('type', searchParams.get('type')!);
    if (searchParams.get('userId')) queryParams.set('userId', searchParams.get('userId')!);
    if (searchParams.get('startDate')) queryParams.set('startDate', searchParams.get('startDate')!);
    if (searchParams.get('endDate')) queryParams.set('endDate', searchParams.get('endDate')!);

    const query = queryParams.toString();

    // Call NestJS backend to get transactions
    interface AdminTransactionsResponse {
      transactions: Array<{
        id: string;
        user_id: string;
        type: string;
        amount: number;
        reference: string | null;
        description: string | null;
        created_at: string;
        [key: string]: unknown;
      }>;
    }

    const response = await nestjsServerFetch<AdminTransactionsResponse>(`/admin/transactions${query ? `?${query}` : ''}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch transactions');
    }

    // nestjsServerFetch returns: { success: true, data: { transactions: [...] } }
    const nestjsData = response.data as AdminTransactionsResponse;
    return successResponseNext({
      transactions: nestjsData.transactions || [],
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
