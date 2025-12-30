import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
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
    
    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return appErrorToResponse(new Error('Authentication required to view quiz'));
    }

    // Call NestJS backend to get quiz (let backend handle auth validation)
    const response = await nestjsServerFetch<any>(`/quizzes/${id}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to fetch quiz'));
    }

    // NestJS returns { success: true, data: { quiz } }
    const quiz = response.data?.quiz || null;

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
    const { id } = await params;
    const body = await request.json();
    
    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return appErrorToResponse(new Error('Authentication required'));
    }

    // Call NestJS backend to update quiz (let backend handle auth validation)
    const response = await nestjsServerFetch<any>(`/quizzes/${id}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to update quiz'));
    }

    // NestJS returns { success: true, data: { quiz } }
    const quiz = response.data?.quiz || null;

    return successResponseNext({
      quiz,
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
    const { id } = await params;
    
    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return appErrorToResponse(new Error('Authentication required'));
    }

    // Call NestJS backend to delete quiz (let backend handle auth validation)
    const response = await nestjsServerFetch(`/quizzes/${id}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to delete quiz'));
    }

    return successResponseNext({ message: 'Quiz deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

