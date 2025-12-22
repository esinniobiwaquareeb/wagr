import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/quizzes/[id]
 * Get a single quiz by ID with questions and answers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return appErrorToResponse(new Error('Authentication required to view quiz'));
    }

    // Verify user is authenticated (but don't throw, just check)
    try {
      await requireAuth();
    } catch (authError) {
      // If auth verification fails, return error
      return appErrorToResponse(new Error('Invalid or expired authentication token'));
    }

    // Call NestJS backend to get quiz
    const response = await nestjsServerFetch<any>(`/quizzes/${id}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch quiz');
    }

    // Backend returns: { success: true, data: { quiz: {...} } }
    // nestjsServerFetch returns the parsed JSON, so response.data is the backend response
    const backendResponse = response.data;
    const quiz = backendResponse?.quiz || backendResponse?.data?.quiz || backendResponse;

    return successResponseNext({
      quiz,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/quizzes/[id]
 * Update a quiz (only creator can update, and only if status is 'draft')
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to update quiz
    const response = await nestjsServerFetch<{
      quiz: any;
    }>(`/quizzes/${id}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to update quiz');
    }

    return successResponseNext({
      quiz: response.data.quiz,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/quizzes/[id]
 * Delete a quiz (only creator can delete, and only if no participants have started)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to delete quiz
    const response = await nestjsServerFetch(`/quizzes/${id}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete quiz');
    }

    return successResponseNext({ message: 'Quiz deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

