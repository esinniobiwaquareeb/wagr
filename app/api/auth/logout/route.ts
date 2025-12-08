import { NextRequest } from 'next/server';
import { nestjsPost, removeAuthToken } from '@/lib/nestjs-client';
import { logError } from '@/lib/error-handler';
import { successResponseNext } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    // Call NestJS backend logout endpoint
    try {
      await nestjsPost('/auth/logout', {}, { requireAuth: true });
    } catch (error) {
      // Continue even if logout fails on backend
      logError(error as Error);
    }

    // Remove token from client
    removeAuthToken();

    return successResponseNext({
      message: 'Logged out successfully',
    });
  } catch (error) {
    logError(error as Error);
    // Remove token even if logout fails
    removeAuthToken();
    
    return successResponseNext({
      message: 'Logged out successfully',
    });
  }
}

