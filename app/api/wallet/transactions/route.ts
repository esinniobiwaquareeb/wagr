import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/wallet/transactions
 * Get user's transaction history
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
    const searchParams = url.searchParams.toString();

    // Call NestJS backend to get transactions
    const response = await nestjsServerFetch<{
      transactions: any[];
    }>(`/wallet/transactions?${searchParams}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch transactions');
    }

    const apiResponse = successResponseNext(
      { transactions: response.data.transactions || [] }
    );
    
    // Add no-cache headers to prevent caching of transaction data
    apiResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    apiResponse.headers.set('Pragma', 'no-cache');
    apiResponse.headers.set('Expires', '0');
    
    return apiResponse;
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

