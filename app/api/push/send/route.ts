import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
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

    // Call NestJS backend to send push notification
    const response = await nestjsServerFetch('/notifications/push/send', {
      method: 'POST',
      requireAuth: false,
      headers: {
        'Authorization': authHeader || '',
      },
      body: JSON.stringify({
        user_id,
        title,
        body: message,
        url,
        data,
      }),
    });

    if (!response.success) {
      logger.error('Failed to send push notification:', response.error);
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: response.error?.message || 'Failed to send push notification',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(response.data || { success: true });
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

