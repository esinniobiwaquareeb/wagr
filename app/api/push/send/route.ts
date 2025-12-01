import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Dynamically import web-push to make it optional
let webpush: any = null;
try {
  webpush = require('web-push');
} catch (e) {
  // web-push is optional
}

/**
 * POST /api/push/send
 * Send push notification to a user
 * Called internally when notifications are created
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, title, body: message, url, data } = body;

    // Verify this is called from an authorized source
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.NOTIFICATION_API_SECRET || process.env.CRON_SECRET;
    
    if (apiSecret && authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user_id || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, title, body' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user preferences for push notifications
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('push_notifications_enabled, notification_enabled, notification_types')
      .eq('user_id', user_id)
      .maybeSingle();

    // If push notifications are disabled, don't send
    if (preferences && preferences.push_notifications_enabled === false) {
      return NextResponse.json({ success: true, message: 'Push notifications disabled for user' });
    }

    // Check if notifications are enabled
    if (preferences && preferences.notification_enabled === false) {
      return NextResponse.json({ success: true, message: 'Notifications disabled for user' });
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', user_id);

    if (subError) {
      logger.error('Error fetching push subscriptions:', subError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'No push subscriptions found' });
    }

    // Check if web-push is available
    if (!webpush) {
      logger.warn('web-push package not installed, skipping push notification');
      return NextResponse.json({ success: true, message: 'web-push package not installed' });
    }

    // Configure web-push
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:noreply@wagr.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.warn('VAPID keys not configured, skipping push notification');
      return NextResponse.json({ success: true, message: 'VAPID keys not configured' });
    }

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

    // Send push notification to all user's subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            JSON.stringify({
              title,
              body: message,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-96x96.png',
              data: {
                url: url || '/',
                ...data,
              },
            })
          );
          return { success: true, endpoint: subscription.endpoint };
        } catch (error: any) {
          // If subscription is invalid, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint);
          }
          throw error;
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    });
  } catch (error) {
    logger.error('Error sending push notification:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

