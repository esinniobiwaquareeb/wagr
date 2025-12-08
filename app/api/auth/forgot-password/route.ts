import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Call NestJS backend to request password reset (no auth required)
    const response = await nestjsServerFetch('/auth/forgot-password', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify(body),
    });

    // Always return success message to prevent email enumeration
    // NestJS backend handles the logic internally
    return successResponseNext({
      message: 'If an account with that email exists, a password reset link has been sent',
    });
  } catch (error) {
    logError(error as Error);
    // Still return success to prevent email enumeration
    return successResponseNext({
      message: 'If an account with that email exists, a password reset link has been sent',
    });
  }
}
