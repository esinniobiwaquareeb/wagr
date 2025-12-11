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
      return successResponseNext({ admin: null });
    }

    // Call NestJS backend to get current admin
    const response = await nestjsServerFetch<{
      admin: {
        id: string;
        email: string;
        username: string | null;
        full_name: string | null;
        role: string;
        is_active: boolean;
        is_admin: boolean;
        type: string;
      };
    }>('/admin/me', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      return successResponseNext({ admin: null });
    }

    return successResponseNext({
      admin: response.data.admin,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
