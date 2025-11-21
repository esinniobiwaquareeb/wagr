import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/wallet/search-users
 * Search for users by username (for transfers)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(); // User must be authenticated to search
    const supabase = await createClient();

    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    if (!query || query.trim().length < 2) {
      return successResponseNext({ users: [] });
    }

    // Remove @ if present
    const searchQuery = query.trim().replace('@', '').toLowerCase();

    // Search for users by username (case-insensitive)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${searchQuery}%`)
      .not('username', 'is', null)
      .limit(10);

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to search users');
    }

    // Format response
    const users = (profiles || []).map(profile => ({
      id: profile.id,
      username: profile.username,
      avatar_url: profile.avatar_url,
    }));

    return successResponseNext({ users });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

