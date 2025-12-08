import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/notifications
 * Get user's notifications
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { page, limit } = getPaginationParams(request);
    const url = new URL(request.url);
    const read = url.searchParams.get('read'); // 'true' or 'false'
    const unreadOnly = read === 'false' ? 'true' : undefined;

    // Build query string
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (unreadOnly) {
      queryParams.append('unreadOnly', 'true');
    }

    // Call NestJS backend to get notifications
    const response = await nestjsServerFetch<{
      notifications: any[];
      unreadCount: number;
      meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/notifications?${queryParams.toString()}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch notifications');
    }

    // Generate links for notifications that don't have them
    const { generateNotificationLink } = await import('@/lib/notification-links');
    const notificationsWithLinks = (response.data.notifications || []).map(notification => ({
      ...notification,
      link: notification.link || generateNotificationLink(
        notification.type,
        notification.metadata,
        notification.link
      ),
    }));

    return successResponseNext({
      notifications: notificationsWithLinks,
      unreadCount: response.data.unreadCount || 0,
    }, response.data.meta);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

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
    const response = await nestjsServerFetch<{ message: string }>('/notifications/mark-all-read', {
      method: 'POST',
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

