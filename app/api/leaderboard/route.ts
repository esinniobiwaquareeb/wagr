import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams, getPaginationMeta } from '@/lib/api-response';
import { getWagerPlatformFee } from '@/lib/settings';

/**
 * GET /api/leaderboard
 * Get leaderboard (top users by balance, wins, win_rate, or winnings)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'wins'; // 'balance', 'wins', 'win_rate', 'winnings'
    const { page, limit } = getPaginationParams(request);

    // For balance-based leaderboard, use simple query
    if (type === 'balance') {
      const offset = (page - 1) * limit;
      const query = supabase
        .from('profiles')
        .select('id, username, avatar_url, balance', { count: 'exact' })
        .is('deleted_at', null)
        .order('balance', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: profiles, error, count } = await query;

      if (error) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch leaderboard');
      }

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
    }

    // For wins/winnings-based leaderboard, calculate stats
    // Exclude deleted users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .is('deleted_at', null);

    if (!profiles) {
      return successResponseNext({ leaderboard: [] });
    }

    // Fetch all wager entries
    const { data: wagerEntries } = await supabase
      .from('wager_entries')
      .select('user_id, wager_id, side, amount');

    // Fetch resolved wagers
    const { data: resolvedWagers } = await supabase
      .from('wagers')
      .select('id, status, winning_side, fee_percentage')
      .in('status', ['RESOLVED', 'SETTLED'])
      .not('winning_side', 'is', null);

    // Calculate stats for each user
    const userStats = new Map<string, {
      total_wagers: number;
      wins: number;
      total_winnings: number;
    }>();

    // Count total wagers per user (unique wager_ids)
    if (wagerEntries && wagerEntries.length > 0) {
      const userWagerSet = new Map<string, Set<string>>();
      
      wagerEntries.forEach((entry: any) => {
        const userId = entry.user_id;
        const wagerId = entry.wager_id;
        
        if (!userWagerSet.has(userId)) {
          userWagerSet.set(userId, new Set());
        }
        userWagerSet.get(userId)!.add(wagerId);
      });
      
      userWagerSet.forEach((wagerSet, userId) => {
        if (!userStats.has(userId)) {
          userStats.set(userId, { total_wagers: 0, wins: 0, total_winnings: 0 });
        }
        userStats.get(userId)!.total_wagers = wagerSet.size;
      });
    }

    // Calculate wins and winnings from resolved wagers
    if (resolvedWagers && wagerEntries) {
      // Get default platform fee from settings once
      const defaultFee = await getWagerPlatformFee();
      
      for (const wager of resolvedWagers) {
        const winningSide = wager.winning_side?.toLowerCase() === 'a' ? 'a' : 'b';
        const feePercentage = Number(wager.fee_percentage) || defaultFee;
        
        const allWagerEntries = wagerEntries.filter((e: any) => e.wager_id === wager.id);
        if (allWagerEntries.length === 0) return;
        
        const totalPool = allWagerEntries.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
        const platformFee = totalPool * feePercentage;
        const winningsPool = totalPool - platformFee;
        
        const winningEntries = allWagerEntries.filter((e: any) => e.side === winningSide);
        const winningSideTotal = winningEntries.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
        
        if (winningSideTotal > 0 && winningsPool > 0) {
          winningEntries.forEach((entry: any) => {
            const userId = entry.user_id;
            const entryAmount = Number(entry.amount || 0);
            
            if (!userStats.has(userId)) {
              userStats.set(userId, { total_wagers: 0, wins: 0, total_winnings: 0 });
            }
            
            const stats = userStats.get(userId)!;
            stats.wins += 1;
            const userWinnings = (entryAmount / winningSideTotal) * winningsPool;
            stats.total_winnings += userWinnings;
          });
        }
      }
    }

    // Combine profile data with stats
    let leaderboardData = profiles
      .map((profile) => {
        const stats = userStats.get(profile.id) || { total_wagers: 0, wins: 0, total_winnings: 0 };
        const winRate = stats.total_wagers > 0 
          ? (stats.wins / stats.total_wagers) * 100 
          : 0;

        return {
          id: profile.id,
          username: profile.username || `User ${profile.id.slice(0, 8)}`,
          total_wagers: stats.total_wagers,
          wins: stats.wins,
          win_rate: winRate,
          total_winnings: stats.total_winnings,
        };
      })
      .filter((user) => user.wins > 0);

    // Sort by selected criteria
    leaderboardData.sort((a, b) => {
      if (type === 'wins') {
        return b.wins - a.wins;
      } else if (type === 'win_rate') {
        return b.win_rate - a.win_rate;
      } else {
        return b.total_winnings - a.total_winnings;
      }
    });

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedData = leaderboardData.slice(offset, offset + limit);
    
    // Assign ranks
    const leaderboard = paginatedData.map((user, index) => ({
      ...user,
      rank: offset + index + 1,
    }));

    return successResponseNext(
      { leaderboard },
      getPaginationMeta(page, limit, leaderboardData.length)
    );
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

