import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError, AppError, ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/payments/verify-account
 * Verify bank account details (proxied to backend)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Account number and bank code are required');
    }

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to verify account
    const response = await nestjsServerFetch<{ account_name: string }>('/payments/verify-account', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        accountNumber,
        bankCode,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to verify account');
    }

    return successResponseNext({
      accountName: response.data.account_name,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

