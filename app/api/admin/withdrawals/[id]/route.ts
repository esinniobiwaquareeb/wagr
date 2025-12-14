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
 * GET /api/admin/withdrawals/[id]
 * Get withdrawal by ID (admin only)
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

    // Call NestJS backend to get withdrawal
    interface WithdrawalResponse {
      withdrawal: {
        id: string;
        user_id: string;
        amount: number;
        status: string;
        bank_account: {
          account_number: string;
          bank_code: string;
          account_name: string;
        };
        [key: string]: unknown;
      };
    }

    const response = await nestjsServerFetch<WithdrawalResponse>(`/admin/withdrawals/${id}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch withdrawal');
    }

    // nestjsServerFetch returns: { success: true, data: { withdrawal } }
    const nestjsData = response.data as WithdrawalResponse;
    return successResponseNext({
      withdrawal: nestjsData.withdrawal,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/admin/withdrawals/[id]
 * Update withdrawal status (admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Reuse WithdrawalResponse interface from GET handler
    interface WithdrawalResponse {
      withdrawal: {
        id: string;
        user_id: string;
        amount: number;
        status: string;
        bank_account: {
          account_number: string;
          bank_code: string;
          account_name: string;
        };
        [key: string]: unknown;
      };
    }

    // Call NestJS backend to update withdrawal
    const updateResponse = await nestjsServerFetch<WithdrawalResponse>(`/admin/withdrawals/${id}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!updateResponse.success || !updateResponse.data) {
      throw new Error(updateResponse.error?.message || 'Failed to update withdrawal');
    }

    // nestjsServerFetch returns: { success: true, data: { withdrawal } }
    const nestjsData = updateResponse.data as WithdrawalResponse;
    return successResponseNext({
      withdrawal: nestjsData.withdrawal,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
