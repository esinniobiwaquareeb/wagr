import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: { message: 'Email and password are required' } },
        { status: 400 }
      );
    }

    // Call NestJS backend admin login endpoint
    // Backend returns: { success: true, data: { admin: {...}, access_token: "..." } }
    const response = await nestjsServerFetch<{
      admin: {
        id: string;
        email: string;
        username: string | null;
        full_name: string | null;
        role: string;
        is_active: boolean;
      };
      access_token: string;
    }>('/admin/login', {
      method: 'POST',
      requireAuth: false,
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    });

    // nestjsServerFetch returns the backend response directly on success
    // So response will be: { success: true, data: { admin: {...}, access_token: "..." } }
    if (!response.success || !response.data) {
      const errorMessage = response.error?.message || response.error?.code || 'Login failed';
      throw new Error(errorMessage);
    }

    const loginData = response.data;

    // Validate that we have the required admin data
    if (!loginData.admin || !loginData.access_token) {
      throw new Error('Invalid response: Missing admin data or access token');
    }

    // Create response
    const nextResponse = successResponseNext({
      admin: loginData.admin,
      token: loginData.access_token,
    });

    // Store JWT token in cookie (for SSR)
    if (loginData.access_token) {
      const cookieStore = await cookies();
      cookieStore.set('auth_token', loginData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
