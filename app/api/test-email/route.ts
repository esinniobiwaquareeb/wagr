import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendWelcomeEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

/**
 * Test endpoint to send a test email
 * For development/testing purposes only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, type = 'welcome' } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    // Verify this is called from an authorized source (optional for testing)
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.NOTIFICATION_API_SECRET || process.env.CRON_SECRET;
    
    // Allow without auth in development, require in production
    if (process.env.NODE_ENV === 'production' && apiSecret && authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Sending test email to:', email);

    // Send test email
    const result = await sendEmail({
      to: email,
      type: type as any,
      data: {
        recipientName: 'Test User',
        loginUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app',
      },
      subject: 'Test Email from wagr',
    });

    if (result) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        email,
        note: 'Check your email inbox. If using a logging email service, check server logs.',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send test email',
        email,
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('Error sending test email:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

