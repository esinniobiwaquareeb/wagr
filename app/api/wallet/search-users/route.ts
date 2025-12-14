import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * GET /api/wallet/search-users
 * Search for users by username (for transfers)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    if (!query || query.trim().length < 2) {
      return successResponseNext({ users: [] });
    }

    // Call NestJS backend to search users
    interface SearchUsersResponse {
      users: Array<{
        id: string;
        username: string | null;
        email: string;
        avatar_url: string | null;
      }>;
    }

    const response = await nestjsServerFetch<SearchUsersResponse>(`/wallet/search-users?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to search users');
    }

    // nestjsServerFetch returns: { success: true, data: { users: [...] } }
    const nestjsData = response.data as SearchUsersResponse;
    return successResponseNext({ users: nestjsData.users || [] });
  } catch (error) {
    logger.error('Search users API error', error);
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

