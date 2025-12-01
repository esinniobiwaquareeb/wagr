import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams, getPaginationMeta } from '@/lib/api-response';

/**
 * GET /api/notifications
 * Get user's notifications
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const { page, limit } = getPaginationParams(request);
    const offset = (page - 1) * limit;

    const url = new URL(request.url);
    const read = url.searchParams.get('read'); // 'true' or 'false'

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (read === 'true') {
      query = query.eq('read', true);
    } else if (read === 'false') {
      query = query.eq('read', false);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch notifications');
    }

    // Generate links for notifications that don't have them
    const { generateNotificationLink } = await import('@/lib/notification-links');
    const notificationsWithLinks = (notifications || []).map(notification => ({
      ...notification,
      link: notification.link || generateNotificationLink(
        notification.type,
        notification.metadata,
        notification.link
      ),
    }));

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    return successResponseNext(
      {
        notifications: notificationsWithLinks,
        unreadCount: unreadCount || 0,
      },
      getPaginationMeta(page, limit, count || 0)
    );
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
    const user = await requireAuth();
    const supabase = await createClient();

    const { error } = await supabase.rpc('mark_all_notifications_read', {
      user_id_param: user.id,
    });

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to mark notifications as read');
    }

    return successResponseNext({ message: 'All notifications marked as read' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

