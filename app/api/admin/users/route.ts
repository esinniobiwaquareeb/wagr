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

    // Get user statistics
    const userIds = profiles?.map(p => p.id) || [];
    
    // Get wagers created count per user
    const { data: wagersData, error: wagersError } = await supabase
      .from("wagers")
      .select("creator_id")
      .in("creator_id", userIds);
    
    if (wagersError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch wagers');
    }
    
    const wagersCountByUser = new Map<string, number>();
    wagersData?.forEach((wager: { creator_id: string | null }) => {
      if (wager.creator_id) {
        wagersCountByUser.set(wager.creator_id, (wagersCountByUser.get(wager.creator_id) || 0) + 1);
      }
    });
    
    // Get entries count per user
    const { data: entriesData, error: entriesError } = await supabase
      .from("wager_entries")
      .select("user_id")
      .in("user_id", userIds);
    
    if (entriesError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch entries');
    }
    
    const entriesCountByUser = new Map<string, number>();
    entriesData?.forEach((entry: { user_id: string }) => {
      entriesCountByUser.set(entry.user_id, (entriesCountByUser.get(entry.user_id) || 0) + 1);
    });
    
    // Get total wagered amount per user
    const { data: entriesWithAmounts, error: amountsError } = await supabase
      .from("wager_entries")
      .select("user_id, amount")
      .in("user_id", userIds);
    
    if (amountsError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch entry amounts');
    }
    
    const totalWageredByUser = new Map<string, number>();
    entriesWithAmounts?.forEach((entry: { user_id: string; amount: string | number }) => {
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

