import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/wagers/[id]/change-side
 * Change entry side for a wager
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const body = await request.json();
    const { side } = body;
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

    // Call NestJS backend to change side
    const response = await nestjsServerFetch<any>(`/wagers/${id}/change-side`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({ side }),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to change side');
    }

    // NestJS returns { success: true, data: { wager }, message: '...' }
    const nestjsResponse = response as any;
    const wager = nestjsResponse.data?.wager || nestjsResponse.wager;
    const message = nestjsResponse.message || nestjsResponse.data?.message || 'Successfully changed side';

    return successResponseNext({
      wager,
      message,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

