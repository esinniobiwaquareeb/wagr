import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth, requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/quizzes
 * List quizzes with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const isAdminView = scope === 'admin';

    await (isAdminView ? requireAdmin() : requireAuth());
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Build query string
    const searchParams = url.searchParams.toString();

    // Call NestJS backend to list quizzes
    const response = await nestjsServerFetch<{
      quizzes: any[];
    }>(`/quizzes?${searchParams}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch quizzes');
    }

    return successResponseNext({
      quizzes: response.data.quizzes || [],
    }, response.meta);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/quizzes
 * Create a new quiz
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to create quiz
    const response = await nestjsServerFetch<{
      quiz: any;
    }>('/quizzes', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create quiz');
    }

    return successResponseNext({
      quiz: response.data.quiz,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

