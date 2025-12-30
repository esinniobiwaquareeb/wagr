import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/quizzes/[id]/invites
 * Get all invites for a quiz
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
      return appErrorToResponse(new Error('Authentication required'));
    }

    // Call NestJS backend (let backend handle auth validation)
    const response = await nestjsServerFetch<any>(`/quizzes/${id}/invites`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to fetch invites'));
    }

    return successResponseNext(response.data || { invites: [] });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

