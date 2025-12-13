import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { successResponseNext } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Get admin token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    // Call NestJS backend admin logout endpoint
    // Backend handles logout gracefully even if token is invalid/expired
    if (token) {
      const response = await nestjsServerFetch('/admin/logout', {
        method: 'POST',
        token,
        requireAuth: true,
      });
      
      // Log only if it's a real error (not just invalid token or connection issue)
      if (!response.success && response.error) {
        const errorCode = response.error.code;
        // Don't log connection errors or unauthorized errors - these are expected
        if (errorCode !== 'CONNECTION_REFUSED' && 
            errorCode !== 'NETWORK_ERROR' && 
            !response.error.message?.includes('Unauthorized')) {
          const { logError } = await import('@/lib/error-handler');
          logError(new Error(response.error.message || 'Admin logout failed'));
        }
      }
    }

    // Clear the auth token cookie
    cookieStore.delete('auth_token');

    // Token removal is handled client-side in lib/auth/client.ts
    return successResponseNext({
      message: 'Logged out successfully',
    });
  } catch (error) {
    // Token removal is handled client-side even if logout fails
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    
    return successResponseNext({
      message: 'Logged out successfully',
    });
  }
}
