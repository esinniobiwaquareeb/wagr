import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * DELETE /api/quizzes/[id]/invites/[inviteId]
 * Revoke/delete a quiz invitation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    await requireAuth();
    const { id, inviteId } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{
      message: string;
    }>(`/quizzes/${id}/invites/${inviteId}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to revoke invitation');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

