import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

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
    const response = await nestjsServerFetch<{
      users: any[];
    }>(`/wallet/search-users?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to search users');
    }

    return successResponseNext({ users: response.data.users || [] });
  } catch (error) {
    console.error('Search users API error:', error);
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

