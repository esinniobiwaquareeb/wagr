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
 * POST /api/admin/withdrawals/[id]/approve
 * Approve a withdrawal (admin only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { id } = await params;

    // Call NestJS backend to approve withdrawal
    interface ApproveWithdrawalResponse {
      withdrawal: {
        id: string;
        user_id: string;
        amount: number;
        status: string;
        [key: string]: unknown;
      };
      message: string;
    }

    const response = await nestjsServerFetch<ApproveWithdrawalResponse>(`/admin/withdrawals/${id}/approve`, {
      method: 'POST',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to approve withdrawal');
    }

    // nestjsServerFetch returns: { success: true, data: { withdrawal, message } }
    const nestjsData = response.data as ApproveWithdrawalResponse;
    return successResponseNext({
      withdrawal: nestjsData.withdrawal,
      message: nestjsData.message || 'Withdrawal approved successfully',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
