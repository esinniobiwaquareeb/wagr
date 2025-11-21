import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams, getPaginationMeta } from '@/lib/api-response';

/**
 * GET /api/wallet/transactions
 * Get user's transaction history
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const { page, limit } = getPaginationParams(request);
    const offset = (page - 1) * limit;

    const url = new URL(request.url);
    const type = url.searchParams.get('type'); // deposit, withdrawal, wager_create, wager_join, wager_win, wager_refund

    // Query transactions for the authenticated user
    // Note: We filter by user_id in the query, RLS policies allow read access
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch transactions');
    }

    const response = successResponseNext(
      { transactions: transactions || [] },
      getPaginationMeta(page, limit, count || 0)
    );
    
    // Add no-cache headers to prevent caching of transaction data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

