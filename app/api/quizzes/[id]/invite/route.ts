import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/quizzes/[id]/invite
 * Invite users to a quiz by username or email
 */
export async function POST(
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

    // Call NestJS backend to invite users (let backend handle auth validation)
    const response = await nestjsServerFetch(`/quizzes/${id}/invite`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to invite users'));
    }

    return successResponseNext(response.data || {});
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

