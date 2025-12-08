import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/leaderboard
 * Get leaderboard (top users by balance, wins, win_rate, or winnings)
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
    const type = url.searchParams.get('type') || 'wins';
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '50';

    // Build query string
    const queryParams = new URLSearchParams({
      type,
      page,
      limit,
    });

    // Call NestJS backend
    const response = await nestjsServerFetch<{
      leaderboard: any[];
      meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/leaderboard?${queryParams.toString()}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch leaderboard');
    }

    return successResponseNext(response.data, response.data.meta);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

