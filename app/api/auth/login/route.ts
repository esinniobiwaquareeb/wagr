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
    // Note: User responses no longer include is_admin since admins are separate entities
    const response = await nestjsServerFetch<{
      user: {
        id: string;
        email: string;
        username: string | null;
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
      const errorMessage = response.error?.message || 'Login failed';
      const errorCode = response.error?.code || 'UNKNOWN_ERROR';
      console.error(`Login failed: [${errorCode}] ${errorMessage}`, {
        error: response.error,
        backendUrl: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1',
      });
      throw new Error(errorMessage);
    }

    const loginData = response.data;

    // Store JWT token in cookie FIRST (for SSR) before creating response
    // This ensures the cookie is available when the response is sent
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

    // Create response with token included for client-side storage
    const nextResponse = successResponseNext({
      user: loginData.user,
      requires2FA: loginData.requires2FA,
      twoFactorVerified: loginData.twoFactorVerified,
      token: loginData.access_token, // Include token in response for client-side storage
    });

    return nextResponse;
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
