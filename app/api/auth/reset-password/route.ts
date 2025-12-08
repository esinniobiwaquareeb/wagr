import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Call NestJS backend to reset password (no auth required)
    const response = await nestjsServerFetch('/auth/reset-password', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to reset password');
    }

    return successResponseNext({
      message: (response.data as any)?.message || 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

