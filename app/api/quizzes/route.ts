import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/quizzes
 * List quizzes with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return appErrorToResponse(new Error('Authentication required'));
    }

    const url = new URL(request.url);

    // Build query string - filter out invalid status values
    const validStatuses = ['draft', 'open', 'in_progress', 'completed', 'settled', 'cancelled'];
    const statusParam = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = url.searchParams.get('page');
    const limit = url.searchParams.get('limit');
    const creatorId = url.searchParams.get('creatorId');
    const scopeParam = url.searchParams.get('scope');

    // Build clean query params
    const cleanParams = new URLSearchParams();
    if (statusParam && validStatuses.includes(statusParam)) {
      cleanParams.set('status', statusParam);
    }
    if (search) {
      cleanParams.set('search', search);
    }
    if (page) {
      cleanParams.set('page', page);
    }
    if (limit) {
      cleanParams.set('limit', limit);
    }
    if (creatorId) {
      cleanParams.set('creatorId', creatorId);
    }
    if (scopeParam) {
      cleanParams.set('scope', scopeParam);
    }

    // Call NestJS backend to list quizzes (let backend handle auth validation)
    const response = await nestjsServerFetch<any>(`/quizzes?${cleanParams.toString()}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to fetch quizzes'));
    }

    // Backend controller returns: { success: true, data: quizzes[], meta: pagination }
    const quizzes = Array.isArray(response.data) ? response.data : [];
    const meta = (response as any).meta;

    return successResponseNext({
      quizzes,
    }, meta);
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
    const body = await request.json();
    
    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return appErrorToResponse(new Error('Authentication required'));
    }

    // Call NestJS backend to create quiz (let backend handle auth validation)
    const response = await nestjsServerFetch<any>('/quizzes', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      return appErrorToResponse(new Error(response.error?.message || 'Failed to create quiz'));
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

