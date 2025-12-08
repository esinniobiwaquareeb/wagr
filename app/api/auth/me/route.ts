import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return successResponseNext({ user: null });
    }

    // Call NestJS backend to get current user
    const response = await nestjsServerFetch<{
      user: {
        id: string;
        email: string;
        username: string | null;
        email_verified: boolean;
        is_admin: boolean;
      };
    }>('/auth/me', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      return successResponseNext({ user: null });
    }

    return successResponseNext({
      user: response.data.user,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

