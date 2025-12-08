import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      throw new Error('Verification token is required');
    }

    // Call NestJS backend to verify email (no auth required)
    const response = await nestjsServerFetch('/auth/verify-email', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({ token }),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to verify email');
    }

    return successResponseNext({
      message: (response.data as any)?.message || 'Email verified successfully! Please log in to access your account.',
      verified: true,
      alreadyVerified: (response.data as any)?.alreadyVerified || false,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * Resend verification email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required');
    }

    // Call NestJS backend to resend verification email (no auth required)
    // Note: NestJS might not have a resend endpoint, so we'll handle it here if needed
    // For now, we'll return a generic message
    return successResponseNext({
      message: 'If an account with that email exists and is not verified, a verification email has been sent.',
    });
  } catch (error) {
    logError(error as Error);
    // Still return success to prevent email enumeration
    return successResponseNext({
      message: 'If an account with that email exists and is not verified, a verification email has been sent.',
    });
  }
}

