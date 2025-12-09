import { NextRequest } from 'next/server';
import { nestjsPost } from '@/lib/nestjs-client';
import { logError } from '@/lib/error-handler';
import { successResponseNext } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    // Call NestJS backend logout endpoint
    // Backend now handles logout gracefully even if token is invalid/expired
    try {
      // Send token if available (for session cleanup), but don't fail if it's invalid
      await nestjsPost('/auth/logout', {}, { requireAuth: true });
    } catch (error) {
      // Backend should not fail, but catch any unexpected errors
      // Log only if it's a real error (not just invalid token)
      if (error instanceof Error && !error.message.includes('Unauthorized')) {
        logError(error as Error);
      }
    }

    // Token removal is handled client-side in lib/auth/client.ts
    return successResponseNext({
      message: 'Logged out successfully',
    });
  } catch (error) {
    // Token removal is handled client-side even if logout fails
    return successResponseNext({
      message: 'Logged out successfully',
    });
  }
}

