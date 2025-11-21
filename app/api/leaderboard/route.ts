import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams, getPaginationMeta } from '@/lib/api-response';

/**
 * GET /api/leaderboard
 * Get leaderboard (top users by balance or winnings)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { page, limit } = getPaginationParams(request);
    const offset = (page - 1) * limit;

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'balance'; // 'balance' or 'winnings'

    let query;
    if (type === 'winnings') {
      // Get users sorted by total winnings from transactions
      query = supabase
        .from('profiles')
        .select('id, username, avatar_url, balance', { count: 'exact' })
        .order('balance', { ascending: false });
    } else {
      // Default: sort by balance
      query = supabase
        .from('profiles')
        .select('id, username, avatar_url, balance', { count: 'exact' })
        .order('balance', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: profiles, error, count } = await query;

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch leaderboard');
    }

    // Calculate rankings
    const leaderboard = (profiles || []).map((profile, index) => ({
      rank: offset + index + 1,
      user: {
        id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
      },
      balance: parseFloat(profile.balance || 0),
    }));

    return successResponseNext(
      { leaderboard },
      getPaginationMeta(page, limit, count || 0)
    );
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

