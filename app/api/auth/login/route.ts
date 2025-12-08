import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, twoFactorCode, isBackupCode, rememberMe } = body;

    // Call NestJS backend login endpoint
    const response = await nestjsServerFetch<{
      user: {
        id: string;
        email: string;
        username: string | null;
        is_admin: boolean;
        email_verified?: boolean;
      };
      access_token: string;
      session_token?: string;
      requires2FA?: boolean;
      twoFactorVerified?: boolean;
    }>('/auth/login', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({
        email,
        password,
        twoFactorCode,
        isBackupCode,
        rememberMe,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Login failed');
    }

    const loginData = response.data;

    // Create response
    const nextResponse = successResponseNext({
      user: loginData.user,
      requires2FA: loginData.requires2FA,
      twoFactorVerified: loginData.twoFactorVerified,
      token: loginData.access_token, // Include token in response for client-side storage
    });

    // Store JWT token in cookie (for SSR)
    if (loginData.access_token) {
      const cookieStore = await cookies();
      cookieStore.set('auth_token', loginData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // 30 days or 1 day
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
