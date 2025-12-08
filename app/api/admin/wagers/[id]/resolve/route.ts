import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/admin/wagers/[id]/resolve
 * Set winning side for a wager (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to resolve wager
    const response = await nestjsServerFetch<{ message: string }>(`/admin/wagers/${id}/resolve`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to resolve wager');
    }

    return successResponseNext({
      message: response.data?.message || 'Winning side set. The wager will be automatically settled by the system when the deadline passes.',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

