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

    // Prepare transfer payload - only include description if provided and valid
    const transferPayload: {
      username: string;
      amount: number;
      description?: string;
    } = {
      username: body.username,
      amount: body.amount,
    };

    // Only include description if it's provided, is a string, and is not empty
    if (body.description && typeof body.description === 'string' && body.description.trim().length > 0) {
      // Ensure description is max 200 characters
      transferPayload.description = body.description.trim().substring(0, 200);
    }

    // Call NestJS backend to transfer funds
    const response = await nestjsServerFetch('/wallet/transfer', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(transferPayload),
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

