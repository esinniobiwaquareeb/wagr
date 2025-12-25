import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to mark all notifications as read
    // Backend endpoint is /notifications/read-all with PATCH method
    const response = await nestjsServerFetch<{ message: string }>('/notifications/read-all', {
      method: 'PATCH',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mark notifications as read');
    }

    return successResponseNext({ message: response.data?.message || 'All notifications marked as read' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

