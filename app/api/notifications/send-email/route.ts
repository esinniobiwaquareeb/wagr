import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWagerSettlementEmail, sendWagerJoinedEmail, sendBalanceUpdateEmail, sendWelcomeEmail, sendQuizSettlementEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { getSetting } from '@/lib/settings';

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
      .maybeSingle();

    const userEmail = user.user.email;
    const userName = profile?.username || null;

    // Check if email notifications are enabled globally
    const emailNotificationsEnabled = await getSetting<boolean>('notifications.enable_email', true);
    if (!emailNotificationsEnabled) {
      return NextResponse.json({
        success: false,
        message: 'Email notifications are disabled',
      });
    }

    // Get notification details if notification_id is provided
    let notificationData = null;
    if (notification_id) {
      const { data: notification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notification_id)
        .maybeSingle();
      
      notificationData = notification;
    }

    // Check specific email type settings
    let typeEnabled = true;
    switch (type) {
      case 'wager_resolved':
        typeEnabled = await getSetting<boolean>('email.enable_wager_settlement', true);
        break;
      case 'wager_joined':
        typeEnabled = await getSetting<boolean>('email.enable_wager_joined', true);
        break;
      case 'balance_update':
        typeEnabled = await getSetting<boolean>('email.enable_balance_updates', true);
        break;
      case 'welcome':
        typeEnabled = await getSetting<boolean>('email.enable_welcome_emails', true);
        break;
      case 'quiz_invitation':
      case 'quiz-invitation':
        typeEnabled = await getSetting<boolean>('email.enable_quiz_invitations', true);
        break;
      case 'quiz_settled':
      case 'quiz-settlement':
        typeEnabled = await getSetting<boolean>('email.enable_quiz_settlement', true);
        break;
    }

    if (!typeEnabled) {
      return NextResponse.json({
        success: false,
        message: `Email type ${type} is disabled`,
      });
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
            .maybeSingle();

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
            .maybeSingle();

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

      case 'quiz_settled':
      case 'quiz-settlement':
        if (metadata?.quiz_id && metadata?.won !== undefined) {
          const { data: quiz } = await supabase
            .from('quizzes')
            .select('title')
            .eq('id', metadata.quiz_id)
            .maybeSingle();

          if (quiz) {
            sendQuizSettlementEmail(
              userEmail,
              userName,
              quiz.title,
              metadata.won === true,
              metadata.amount || 0,
              metadata.rank || null,
              metadata.quiz_id
            );
            emailSent = true; // Email queued successfully
          }
        }
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

