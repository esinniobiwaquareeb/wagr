/**
 * @deprecated These functions are deprecated. Bill payment operations are now handled by NestJS backend.
 * These functions are kept for backward compatibility but should not be used.
 * Use NestJS API endpoints instead.
 */

import { AppError, ErrorCode, logError } from '@/lib/error-handler';

/**
 * @deprecated Use NestJS bills service instead
 */
export async function markPaymentAsFailed({
  paymentId,
  reason,
  details,
}: {
  paymentId: string;
  reason: string;
  details?: Record<string, any>;
}) {
  // This function is deprecated - bill payment operations are handled by NestJS backend
  // This is kept for backward compatibility only
  console.warn('markPaymentAsFailed is deprecated. Use NestJS bills API instead.');
}

/**
 * @deprecated Use NestJS bills service instead
 */
export async function refundBillPayment({
  userId,
  amount,
  paymentId,
  reference,
}: {
  userId: string;
  amount: number;
  paymentId: string;
  reference: string;
}) {
  // This function is deprecated - bill payment operations are handled by NestJS backend
  // This is kept for backward compatibility only
  console.warn('refundBillPayment is deprecated. Use NestJS bills API instead.');
}

