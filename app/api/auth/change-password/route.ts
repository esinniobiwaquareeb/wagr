import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

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

    // Call NestJS backend to change password
    const response = await nestjsServerFetch('/auth/change-password', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to change password');
    }

    return successResponseNext({
      message: (response.data as any)?.message || 'Password changed successfully',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

