import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/admin/users
 * Get all users with statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    
    // Get all profiles (emails are in profiles table with custom auth)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch profiles');
    }

    // Get user statistics in parallel (optimized)
    const userIds = profiles?.map(p => p.id) || [];
    
    // Fetch all statistics in parallel for better performance
    const [wagersResult, entriesResult] = await Promise.all([
      userIds.length > 0 ? supabase
        .from("wagers")
        .select("creator_id")
        .in("creator_id", userIds)
        .then(({ data, error }) => ({ data, error })) : Promise.resolve({ data: [], error: null }),
      userIds.length > 0 ? supabase
        .from("wager_entries")
        .select("user_id, amount")
        .in("user_id", userIds)
        .then(({ data, error }) => ({ data, error })) : Promise.resolve({ data: [], error: null }),
    ]);
    
    if (wagersResult.error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch wagers');
    }
    
    if (entriesResult.error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch entries');
    }
    
    // Process statistics efficiently
    const wagersCountByUser = new Map<string, number>();
    wagersResult.data?.forEach((wager: { creator_id: string | null }) => {
      if (wager.creator_id) {
        wagersCountByUser.set(wager.creator_id, (wagersCountByUser.get(wager.creator_id) || 0) + 1);
      }
    });
    
    const entriesCountByUser = new Map<string, number>();
    const totalWageredByUser = new Map<string, number>();
    
    entriesResult.data?.forEach((entry: { user_id: string; amount: string | number }) => {
      // Count entries
      entriesCountByUser.set(entry.user_id, (entriesCountByUser.get(entry.user_id) || 0) + 1);
      // Sum amounts
      const current = totalWageredByUser.get(entry.user_id) || 0;
      totalWageredByUser.set(entry.user_id, current + Number(entry.amount || 0));
    });

    // Merge profiles with stats (emails are already in profiles table)
    const usersWithStats = profiles?.map((profile) => {
      return {
        ...profile,
        wagers_created: wagersCountByUser.get(profile.id) || 0,
        entries_count: entriesCountByUser.get(profile.id) || 0,
        total_wagered: totalWageredByUser.get(profile.id) || 0,
      };
    }) || [];

    return successResponseNext({ users: usersWithStats });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

