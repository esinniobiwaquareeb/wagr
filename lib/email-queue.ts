/**
 * Background Email Queue
 * Non-blocking email sending system
 * Emails are sent in the background without blocking API responses
 */

import { sendEmail, type SendEmailOptions } from './email-service';
import { logger } from './logger';
import { getSetting } from './settings';

interface QueuedEmail extends SendEmailOptions {
  id: string;
  retries: number;
  createdAt: number;
}

class EmailQueue {
  private queue: QueuedEmail[] = [];
  private processing = false;
  private maxRetries = 3;
  private retryDelay = 5000; // 5 seconds

  /**
   * Add email to queue (non-blocking)
   * Checks platform settings before queuing
   */
  async enqueue(options: SendEmailOptions): Promise<void> {
    try {
      // Check if email notifications are enabled globally
      const emailNotificationsEnabled = await getSetting<boolean>('notifications.enable_email', true);
      if (!emailNotificationsEnabled) {
        logger.info('Email notifications disabled globally, skipping:', { to: options.to, type: options.type });
        return;
      }

      // Check specific email type settings
      let typeEnabled = true;
      const emailType = options.type as string;
      
      // Map email types to settings (handle both formats)
      if (emailType === 'quiz-invitation' || emailType === 'quiz_invitation') {
        typeEnabled = await getSetting<boolean>('email.enable_quiz_invitations', true);
      } else if (emailType === 'wager_resolved' || emailType === 'wager-settlement') {
        typeEnabled = await getSetting<boolean>('email.enable_wager_settlement', true);
      } else if (emailType === 'wager_joined' || emailType === 'wager-joined') {
        typeEnabled = await getSetting<boolean>('email.enable_wager_joined', true);
      } else if (emailType === 'balance_update' || emailType === 'balance-update') {
        typeEnabled = await getSetting<boolean>('email.enable_balance_updates', true);
      } else if (emailType === 'welcome') {
        typeEnabled = await getSetting<boolean>('email.enable_welcome_emails', true);
      } else if (emailType === 'quiz-settlement' || emailType === 'quiz_settled') {
        // Check if quiz settlement emails are enabled (default to true if not set)
        typeEnabled = await getSetting<boolean>('email.enable_quiz_settlement', true);
      }

      if (!typeEnabled) {
        logger.info(`Email type ${options.type} disabled, skipping:`, { to: options.to, type: options.type });
        return;
      }

      const email: QueuedEmail = {
        ...options,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        retries: 0,
        createdAt: Date.now(),
      };

      this.queue.push(email);
      logger.info('Email queued:', { to: options.to, type: options.type, id: email.id });

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue().catch((error) => {
          logger.error('Email queue processing error:', error);
        });
      }
    } catch (error) {
      // If settings check fails, log but don't block (fail open for reliability)
      logger.error('Error checking email settings, sending anyway:', { error, type: options.type });
      const email: QueuedEmail = {
        ...options,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        retries: 0,
        createdAt: Date.now(),
      };
      this.queue.push(email);
      if (!this.processing) {
        this.processQueue().catch((err) => {
          logger.error('Email queue processing error:', err);
        });
      }
    }
  }

  /**
   * Process email queue in background
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const email = this.queue.shift();
      if (!email) break;

      try {
        const success = await sendEmail({
          to: email.to,
          type: email.type,
          data: email.data,
          subject: email.subject,
        });

        if (success) {
          logger.info('Queued email sent successfully:', { id: email.id, to: email.to });
        } else {
          // Retry if failed
          this.handleRetry(email);
        }
      } catch (error) {
        logger.error('Error sending queued email:', { id: email.id, error });
        this.handleRetry(email);
      }

      // Small delay to prevent overwhelming the SMTP server (reduced for faster processing)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    this.processing = false;
  }

  /**
   * Handle retry logic for failed emails
   */
  private handleRetry(email: QueuedEmail): void {
    if (email.retries < this.maxRetries) {
      email.retries++;
      logger.info('Retrying email:', { id: email.id, retry: email.retries });
      
      // Add back to queue with delay
      setTimeout(() => {
        this.queue.push(email);
        if (!this.processing) {
          this.processQueue().catch((error) => {
            logger.error('Email queue processing error:', error);
          });
        }
      }, this.retryDelay * email.retries);
    } else {
      logger.error('Email failed after max retries:', { id: email.id, to: email.to });
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { queueLength: number; processing: boolean } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }
}

// Singleton instance
const emailQueue = new EmailQueue();

/**
 * Send email in background (non-blocking)
 * Returns immediately without waiting for email to be sent
 * Checks platform settings before sending
 */
export async function sendEmailAsync(options: SendEmailOptions): Promise<void> {
  await emailQueue.enqueue(options);
}

/**
 * Send email synchronously (for critical emails that must be sent immediately)
 * Use sparingly - prefer sendEmailAsync for better performance
 */
export { sendEmail } from './email-service';

/**
 * Get email queue status
 */
export function getEmailQueueStatus() {
  return emailQueue.getStatus();
}

