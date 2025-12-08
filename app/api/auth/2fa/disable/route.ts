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
    const { password } = body;

    if (!password) {
      throw new Error('Password is required to disable 2FA');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch('/auth/2fa/disable', {
      method: 'POST',
      token,
      requireAuth: true,
      body: {
        password,
      },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to disable 2FA');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

