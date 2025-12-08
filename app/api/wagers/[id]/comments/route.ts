import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/wagers/[id]/comments
 * Get all comments for a wager
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get auth token from cookies for server-side request (optional - comments may be public)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;
    
    // Call NestJS backend to get comments
    const response = await nestjsServerFetch<any>(`/wagers/${id}/comments`, {
      method: 'GET',
      token,
      requireAuth: false, // Public endpoint
    });

    if (!response.success) {
      return successResponseNext({ comments: [] });
    }

    // NestJS returns { success: true, data: { comments } }
    const comments = response.data?.comments || (response.data as any)?.comments || [];

    return successResponseNext({
      comments,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/wagers/[id]/comments
 * Create a comment or reply on a wager
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const body = await request.json();
    const { content, parent_id } = body;
    const { id } = await params;

    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new Error('Comment content is required');
    }

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to create comment
    const response = await nestjsServerFetch<any>(`/wagers/${id}/comments`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        content: content.trim(),
        parent_id: parent_id || undefined,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create comment');
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
