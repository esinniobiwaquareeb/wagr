/**
 * Email Service
 * Handles sending emails using the email template system
 * Currently uses Supabase's built-in email service
 * Can be extended to use custom email providers (Resend, SendGrid, etc.)
 */

import { generateEmailHTML, generateEmailText, getEmailSubject, type EmailTemplateData } from './email-templates';
import { logger } from './logger';

export interface SendEmailOptions {
  to: string;
  type: EmailTemplateData['type'];
  data: Omit<EmailTemplateData, 'type' | 'recipientEmail'>;
  subject?: string;
}

/**
 * Send email using Supabase Auth email service
 * Note: Supabase handles emails for auth events automatically
 * This function is for custom emails (wager notifications, etc.)
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const { to, type, data, subject } = options;
    
    // For now, we'll use Supabase's email service via their API
    // In production, you might want to use a dedicated email service like Resend, SendGrid, etc.
    
    const emailData: EmailTemplateData = {
      type,
      recipientEmail: to,
      ...data,
      subject,
    };

    const htmlContent = generateEmailHTML(emailData);
    const textContent = generateEmailText(emailData);
    const emailSubject = subject || getEmailSubject(type);

    // TODO: Integrate with email service provider
    // For now, log the email (in production, send via Resend, SendGrid, etc.)
    logger.info('Email would be sent:', {
      to,
      subject: emailSubject,
      type,
    });

    // Example: If using Resend
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'wagr <noreply@wagr.app>',
    //   to,
    //   subject: emailSubject,
    //   html: htmlContent,
    //   text: textContent,
    // });

    // For Supabase, you can use their email API if configured
    // Or use a webhook/edge function to send emails

    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send email notification for wager settlement
 */
export async function sendWagerSettlementEmail(
  userEmail: string,
  userName: string | null,
  wagerTitle: string,
  won: boolean,
  amount: number,
  wagerId: string
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';
  
  return sendEmail({
    to: userEmail,
    type: 'welcome', // We'll create a specific type for this
    data: {
      recipientName: userName || undefined,
      loginUrl: `${appUrl}/wager/${wagerId}`,
    },
    subject: won 
      ? `🎉 You won ${amount} on "${wagerTitle}"!` 
      : `Wager resolved: "${wagerTitle}"`,
  });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string | null
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';
  
  return sendEmail({
    to: userEmail,
    type: 'welcome',
    data: {
      recipientName: userName || undefined,
      loginUrl: `${appUrl}/wagers`,
    },
  });
}

/**
 * Send email when someone joins a user's wager
 */
export async function sendWagerJoinedEmail(
  creatorEmail: string,
  creatorName: string | null,
  wagerTitle: string,
  participantCount: number,
  wagerId: string
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';
  
  return sendEmail({
    to: creatorEmail,
    type: 'welcome', // We'll extend this
    data: {
      recipientName: creatorName || undefined,
      loginUrl: `${appUrl}/wager/${wagerId}`,
    },
    subject: `${participantCount} ${participantCount === 1 ? 'person has' : 'people have'} joined "${wagerTitle}"`,
  });
}

/**
 * Send email for balance updates (deposits, withdrawals, winnings)
 */
export async function sendBalanceUpdateEmail(
  userEmail: string,
  userName: string | null,
  amount: number,
  type: 'deposit' | 'withdrawal' | 'wager_win' | 'wager_loss'
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';
  
  return sendEmail({
    to: userEmail,
    type: 'welcome', // We'll extend this
    data: {
      recipientName: userName || undefined,
      loginUrl: `${appUrl}/wallet`,
    },
    subject: type === 'wager_win' 
      ? `🎉 You won ${amount}!`
      : type === 'deposit'
      ? `Deposit of ${amount} successful`
      : type === 'withdrawal'
      ? `Withdrawal of ${amount} processed`
      : `Balance update: ${amount}`,
  });
}

