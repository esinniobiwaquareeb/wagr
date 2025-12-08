import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const body = await request.json();
    const { amount, accountNumber, bankCode, accountName } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (!accountNumber || !bankCode || !accountName) {
      throw new Error('Bank account details are required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{
      message: string;
      withdrawal: {
        id: string;
        amount: number;
        status: string;
        reference: string;
      };
    }>('/wallet/withdraw', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        amount,
        accountNumber,
        bankCode,
        accountName,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to process withdrawal');
    }

    return successResponseNext(response.data, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

