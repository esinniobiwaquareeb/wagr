import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/wallet/balance
 * Get current user's wallet balance
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch balance');
    }

    const response = successResponseNext({
      balance: parseFloat(profile.balance || 0),
      currency: 'NGN', // Default currency
    });
    
    // Add no-cache headers to prevent caching of balance data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

