import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWagerSettlementEmail, sendWagerJoinedEmail, sendBalanceUpdateEmail, sendWelcomeEmail } from '@/lib/email-service';
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user email and profile
    const { data: user } = await supabase.auth.admin.getUserById(user_id);
    if (!user?.user?.email) {
      return NextResponse.json(
        { error: 'User not found or no email' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user_id)
      .single();

    const userEmail = user.user.email;
    const userName = profile?.username || null;

    // Get notification details if notification_id is provided
    let notificationData = null;
    if (notification_id) {
      const { data: notification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notification_id)
        .single();
      
      notificationData = notification;
    }

    // Send email based on type
    let emailSent = false;

    switch (type) {
      case 'wager_resolved':
        if (metadata?.wager_id && metadata?.won !== undefined) {
          const { data: wager } = await supabase
            .from('wagers')
            .select('title')
            .eq('id', metadata.wager_id)
            .single();

          if (wager) {
            sendWagerSettlementEmail(
              userEmail,
              userName,
              wager.title,
              metadata.won === true,
              metadata.amount || 0,
              metadata.wager_id
            );
            emailSent = true; // Email queued successfully
          }
        }
        break;

      case 'wager_joined':
        if (metadata?.wager_id) {
          const { data: wager } = await supabase
            .from('wagers')
            .select('title')
            .eq('id', metadata.wager_id)
            .single();

          if (wager) {
            sendWagerJoinedEmail(
              userEmail,
              userName,
              wager.title,
              metadata.participant_count || 1,
              metadata.wager_id
            );
            emailSent = true; // Email queued successfully
          }
        }
        break;

      case 'balance_update':
        if (metadata?.amount && metadata?.type) {
          sendBalanceUpdateEmail(
            userEmail,
            userName,
            metadata.amount,
            metadata.type
          );
          emailSent = true; // Email queued successfully
        }
        break;

      case 'welcome':
        sendWelcomeEmail(userEmail, userName);
        emailSent = true; // Email queued successfully
        break;

      default:
        logger.warn(`Unknown email notification type: ${type}`);
    }

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

