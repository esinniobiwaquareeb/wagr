import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/quizzes/[id]/decline
 * Decline a quiz invitation (invited user only)
 */
export async function POST(
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
    const response = await nestjsServerFetch<any>(`/quizzes/${id}/decline`, {
      method: 'POST',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to decline invitation'));
    }

    return successResponseNext(response.data || { message: 'Invitation declined' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

