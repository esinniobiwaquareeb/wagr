/**
 * Email Service
 * Handles sending emails using SMTP
 * Configured via environment variables
 */

import { generateEmailHTML, generateEmailText, getEmailSubject, type EmailTemplateData } from './email-templates';
import { logger } from './logger';

// Dynamic import for nodemailer to avoid issues if not installed
let nodemailer: any = null;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  logger.warn('nodemailer not installed. Email sending will be disabled.');
}

export interface SendEmailOptions {
  to: string;
  type: EmailTemplateData['type'];
  data: Omit<EmailTemplateData, 'type' | 'recipientEmail'>;
  subject?: string;
}

/**
 * Create SMTP transporter
 */
function createTransporter() {
  if (!nodemailer) {
    throw new Error('nodemailer is not installed');
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED !== 'false';

  if (!host || !user || !password) {
    throw new Error('SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass: password,
    },
    tls: {
      rejectUnauthorized,
    },
  });
}

/**
 * Send email using SMTP
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const { to, type, data, subject } = options;
    
    const emailData: EmailTemplateData = {
      type,
      recipientEmail: to,
      ...data,
      subject,
    };

    const htmlContent = generateEmailHTML(emailData);
    const textContent = generateEmailText(emailData);
    const emailSubject = subject || getEmailSubject(type);
    const fromAddress = process.env.SMTP_FROM || 'wagr <noreply@wagr.app>';

    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      logger.warn('SMTP not configured. Email would be sent:', {
        to,
        subject: emailSubject,
        type,
      });
      return false;
    }

    // Create transporter and send email
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
    });

    logger.info('Email sent successfully:', {
      to,
      subject: emailSubject,
      messageId: info.messageId,
      type,
    });

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
      : `😔 Oops, you lost the bet on "${wagerTitle}"`,
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

