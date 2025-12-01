import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      // User might be suspended or deleted - clear session cookie
      const { clearSessionCookie } = await import('@/lib/auth/session');
      await clearSessionCookie();
      return successResponseNext({ user: null });
    }

    return successResponseNext({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        email_verified: user.email_verified,
        is_admin: user.is_admin,
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

