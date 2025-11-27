import { createServiceRoleClient } from '@/lib/supabase/server';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';

export type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

export async function markPaymentAsFailed({
  supabaseAdmin,
  paymentId,
  reason,
  details,
}: {
  supabaseAdmin: SupabaseServiceClient;
  paymentId: string;
  reason: string;
  details?: Record<string, any>;
}) {
  await supabaseAdmin
    .from('bill_payments')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      remark: reason,
      ...(details && { metadata: details }),
    })
    .eq('id', paymentId);
}

export async function refundBillPayment({
  supabaseAdmin,
  userId,
  amount,
  paymentId,
  reference,
}: {
  supabaseAdmin: SupabaseServiceClient;
  userId: string;
  amount: number;
  paymentId: string;
  reference: string;
}) {
  const refundReference = `${reference}_refund`;

  const { data: refundTransaction, error: refundTransactionError } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'bill_airtime_refund',
      amount,
      reference: refundReference,
      description: 'Refund for failed airtime purchase',
    })
    .select('id')
    .single();

  if (refundTransactionError || !refundTransaction) {
    logError(new Error(refundTransactionError?.message || 'refund_transaction_failed'), {
      userId,
      amount,
      paymentId,
    });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'Failed to refund your balance. Please contact support.',
    );
  }

  const { error: refundBalanceError } = await supabaseAdmin.rpc('increment_balance', {
    user_id: userId,
    amt: amount,
  });

  if (refundBalanceError) {
    logError(new Error(refundBalanceError.message), {
      userId,
      amount,
      paymentId,
    });
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'Refund could not be completed automatically. Please contact support.',
    );
  }

  await supabaseAdmin
    .from('bill_payments')
    .update({
      refunded_at: new Date().toISOString(),
      refund_transaction_id: refundTransaction.id,
    })
    .eq('id', paymentId);
}

