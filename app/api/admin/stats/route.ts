import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();

    // Get total users
    const { count: userCount, error: userError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (userError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch user count');
    }

    // Get wager stats
    const { data: wagersData, error: wagersError } = await supabase
      .from("wagers")
      .select("status, amount");

    if (wagersError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch wagers');
    }

    const openWagers = wagersData?.filter(w => w.status === "OPEN").length || 0;
    const resolvedWagers = wagersData?.filter(w => w.status === "RESOLVED" || w.status === "SETTLED").length || 0;

    // Get transaction stats
    const { data: transactionsData, error: transactionsError } = await supabase
      .from("transactions")
      .select("amount, type");

    if (transactionsError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch transactions');
    }

    const totalVolume = transactionsData
      ?.filter(t => t.type === "deposit" || t.type === "wager_join")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

    const stats = {
      totalUsers: userCount || 0,
      totalWagers: wagersData?.length || 0,
      openWagers,
      resolvedWagers,
      totalTransactions: transactionsData?.length || 0,
      totalVolume,
    };

    return successResponseNext({ stats });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

