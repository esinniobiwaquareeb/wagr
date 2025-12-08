import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { page, limit } = getPaginationParams(request);
    const offset = (page - 1) * limit;
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const creatorId = url.searchParams.get('creator_id');

    // Build query string (backend uses offset, not page)
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    
    if (status && status !== 'all') {
      queryParams.set('status', status);
    }
    if (search) {
      queryParams.set('search', search);
    }
    if (creatorId) {
      queryParams.set('creatorId', creatorId);
    }

    // Call NestJS backend - use admin quizzes endpoint
    const response = await nestjsServerFetch<{
      quizzes: any[];
    }>(`/admin/quizzes?${queryParams.toString()}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch quizzes');
    }

    return successResponseNext({
      quizzes: response.data.quizzes || [],
      pagination: {
        page,
        limit,
        total: response.data.quizzes?.length || 0,
        totalPages: Math.ceil((response.data.quizzes?.length || 0) / limit),
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}


