import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logger } from '@/lib/logger';

/**
 * API endpoint to send email notifications
 * Called by database triggers or other services
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_id, user_id, type, metadata } = body;

    // Verify this is called from an authorized source
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.NOTIFICATION_API_SECRET || process.env.CRON_SECRET;
    
    if (apiSecret && authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user_id || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, type' },
        { status: 400 }
      );
    }

    // Call NestJS backend to send email notification
    const response = await nestjsServerFetch('/notifications/send-email', {
      method: 'POST',
      requireAuth: false,
      headers: {
        'Authorization': authHeader || '',
      },
      body: JSON.stringify({
        notification_id,
        user_id,
        type,
        metadata,
      }),
    });

    if (!response.success) {
      logger.error('Failed to send email notification:', response.error);
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: response.error?.message || 'Failed to send email notification',
        },
        { status: 500 }
      );
    }

    const emailSent = (response.data as any)?.success || false;

    return NextResponse.json({
      success: emailSent,
      message: emailSent ? 'Email sent successfully' : 'Email sending failed or skipped',
    });
  } catch (error) {
    logger.error('Error sending email notification:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

