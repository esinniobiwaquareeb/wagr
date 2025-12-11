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

    // Try user endpoint first
    const userResponse = await nestjsServerFetch<{
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

    // Check if user endpoint succeeded
    // On success: nestjsServerFetch returns data directly { user: {...} }
    // On failure: nestjsServerFetch returns { success: false, error: {...} }
    if (userResponse.success !== false && (userResponse as any).user) {
      // User endpoint succeeded, return user data
      return successResponseNext({
        user: (userResponse as any).user,
      });
    }

    // User endpoint failed or no user data, try admin endpoint (for admin tokens)
    const adminResponse = await nestjsServerFetch<{
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

    // Check if admin endpoint succeeded
    if (adminResponse.success !== false && (adminResponse as any).admin) {
      const admin = (adminResponse as any).admin;
      return successResponseNext({
        user: {
          id: admin.id,
          email: admin.email,
          username: admin.username,
          email_verified: true, // Admins don't have email verification
          is_admin: true,
        },
      });
    }

    // Both endpoints failed
    return successResponseNext({ user: null });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

