import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';
import { cookies } from 'next/headers';
import { getCurrentAdmin } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return successResponseNext({ admin: null });
    }

    // Verify admin access using server-side auth (this ensures token is valid admin token)
    const admin = await getCurrentAdmin();
    
    if (!admin) {
      // Token exists but is not a valid admin token
      return successResponseNext({ admin: null });
    }

    // Call NestJS backend to get current admin (double-check with backend)
    const response = await nestjsServerFetch<{
      admin: {
        id: string;
        email: string;
        username: string | null;
        full_name: string | null;
        role: string;
        permissions: string[];
        is_active: boolean;
        is_admin: boolean;
        type: string;
        two_factor_enabled?: boolean;
      };
    }>('/admin/me', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data?.admin) {
      return successResponseNext({ admin: null });
    }

    return successResponseNext({
      admin: response.data.admin,
    });
  } catch (error) {
    // Don't log auth errors - just return null admin
    if (error instanceof Error && 
        (error.message.includes('Unauthorized') || 
         error.message.includes('Forbidden') ||
         error.message.includes('Admin access'))) {
      return successResponseNext({ admin: null });
    }
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
