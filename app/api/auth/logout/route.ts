import { NextRequest } from 'next/server';
import { getSessionFromCookie, deleteSession, clearSessionCookie } from '@/lib/auth/session';
import { logError } from '@/lib/error-handler';
import { successResponseNext } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const token = await getSessionFromCookie();
    
    if (token) {
      await deleteSession(token);
    }

    await clearSessionCookie();

    return successResponseNext({
      message: 'Logged out successfully',
    });
  } catch (error) {
    logError(error as Error);
    // Clear cookie even if session deletion fails
    await clearSessionCookie();
    
    return successResponseNext({
      message: 'Logged out successfully',
    });
  }
}

