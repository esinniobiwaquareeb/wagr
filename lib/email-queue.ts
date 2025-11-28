/**
 * Background Email Queue
 * Non-blocking email sending system
 * Emails are sent in the background without blocking API responses
 */

import { sendEmail, type SendEmailOptions } from './email-service';
import { logger } from './logger';

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
   */
  enqueue(options: SendEmailOptions): void {
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
 */
export function sendEmailAsync(options: SendEmailOptions): void {
  emailQueue.enqueue(options);
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

