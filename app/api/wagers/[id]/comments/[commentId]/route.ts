import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * PATCH /api/wagers/[id]/comments/[commentId]
 * Update a comment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    await requireAuth();
    const body = await request.json();
    const { content } = body;
    const { id, commentId } = await params;

    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new Error('Comment content is required');
    }

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to update comment
    const response = await nestjsServerFetch<any>(`/wagers/${id}/comments/${commentId}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify({ content: content.trim() }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to update comment');
    }

    // NestJS returns { success: true, data: { comment } }
    const comment = response.data?.comment || (response.data as any)?.comment;

    return successResponseNext({
      comment,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/wagers/[id]/comments/[commentId]
 * Delete a comment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    await requireAuth();
    const { id, commentId } = await params;

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to delete comment
    const response = await nestjsServerFetch<any>(`/wagers/${id}/comments/${commentId}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete comment');
    }

    // NestJS returns { success: true, data: { message } }
    const message = response.data?.message || 'Comment deleted successfully';

    return successResponseNext({
      message,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

