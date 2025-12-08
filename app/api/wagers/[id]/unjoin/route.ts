import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/wagers/[id]/unjoin
 * Unjoin from a wager (refund entry)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    
    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to unjoin wager
    const response = await nestjsServerFetch<any>(`/wagers/${id}/unjoin`, {
      method: 'POST',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unjoin wager');
    }

    // NestJS returns { success: true, data: { wager }, message: '...' }
    const nestjsResponse = response as any;
    const wager = nestjsResponse.data?.wager || nestjsResponse.wager;
    const message = nestjsResponse.message || nestjsResponse.data?.message || 'Successfully unjoined wager';

    return successResponseNext({
      wager,
      message,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

