import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/wagers/[id]/join
 * Join a wager on a specific side
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(); // Ensure user is authenticated
    const body = await request.json();
    const { side, amount } = body; // 'a' or 'b', and optional amount
    const { id } = await params;

    if (!side || (side !== 'a' && side !== 'b')) {
      throw new Error('Side must be "a" or "b"');
    }

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Prepare payload - include amount if provided (for variable amounts feature)
    const payload: { side: 'a' | 'b'; amount?: number } = { side };
    if (amount !== undefined && amount !== null) {
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        payload.amount = parsedAmount;
      }
    }

    // Call NestJS backend to join wager
    const response = await nestjsServerFetch<{ wager: any; message: string }>(`/wagers/${id}/join`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(payload),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to join wager');
    }

    // NestJS returns { success: true, data: { wager }, message: '...' }
    const nestjsResponse = response as any;
    const wager = nestjsResponse.data?.wager || nestjsResponse.wager;
    const message = nestjsResponse.message || nestjsResponse.data?.message || 'Successfully joined wager';

    return successResponseNext({
      wager,
      message,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

