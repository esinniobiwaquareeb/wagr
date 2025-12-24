import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/wagers/[id]/resolve
 * Resolve a wager by setting the winning side (creator only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(); // Ensure user is authenticated
    const { id } = await params;
    const body = await request.json();

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to resolve wager
    const response = await nestjsServerFetch<{ success: boolean; message?: string }>(`/wagers/${id}/resolve`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to resolve wager');
    }

    // NestJS backend returns { success: true, data: { message: '...' } }
    const backendResponse = response.data as { success?: boolean; message?: string };
    const message = backendResponse?.message || response.data?.message || 'Winning side set. The wager will be automatically settled by the system when the deadline passes.';

    return successResponseNext({
      message,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

