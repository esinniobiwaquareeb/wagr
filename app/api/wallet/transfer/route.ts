import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/wallet/transfer
 * Transfer funds from one user to another by username
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to transfer funds
    const response = await nestjsServerFetch('/wallet/transfer', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to transfer funds');
    }

    const data = response.data as any;
    return successResponseNext({
      message: data.message || 'Transfer successful',
      transfer: data.transfer,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

