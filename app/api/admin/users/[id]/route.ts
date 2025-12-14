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
 * GET /api/admin/users/[id]
 * Get user by ID with detailed statistics (admin only)
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

    // Call NestJS backend to get user details
    interface AdminUserDetailResponse {
      user: {
        id: string;
        email: string;
        username: string | null;
        balance: number;
        is_suspended: boolean;
        email_verified: boolean;
        created_at: string;
        [key: string]: unknown;
      };
      statistics: {
        total_wagers: number;
        total_entries: number;
        total_winnings: number;
        [key: string]: unknown;
      };
      activities: {
        wagersCreated: Array<{ id: string; title: string; [key: string]: unknown }>;
        wagerEntries: Array<{ id: string; wager_id: string; [key: string]: unknown }>;
        transactions: Array<{ id: string; type: string; amount: number; [key: string]: unknown }>;
        quizzesCreated: Array<{ id: string; title: string; [key: string]: unknown }>;
        quizParticipations: Array<{ id: string; quiz_id: string; [key: string]: unknown }>;
        withdrawals: Array<{ id: string; amount: number; status: string; [key: string]: unknown }>;
        billPayments: Array<{ id: string; amount: number; [key: string]: unknown }>;
      };
    }

    const response = await nestjsServerFetch<AdminUserDetailResponse>(`/admin/users/${id}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch user details');
    }

    // nestjsServerFetch returns: { success: true, data: { user, statistics, activities } }
    const nestjsData = response.data as AdminUserDetailResponse;
    return successResponseNext(nestjsData);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Soft delete a user account (only if no activities)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch(`/admin/users/${id}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete user');
    }

    return successResponseNext(response.data || { message: 'User account deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

