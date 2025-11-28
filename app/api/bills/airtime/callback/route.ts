import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { successResponseNext, errorResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';
import { refundBillPayment, markPaymentAsFailed } from '@/lib/bills/payment-helpers';
import { getBillsSettings } from '@/lib/settings';
import { getBillsProvider } from '@/lib/bills/providers';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const rawOrderId = url.searchParams.get('orderid') || url.searchParams.get('OrderID');
    const rawRequestId = url.searchParams.get('requestid') || url.searchParams.get('RequestID');
    const rawRemark = url.searchParams.get('orderremark') || url.searchParams.get('OrderRemark');
    
    // Sanitize input parameters
    const { sanitizeString } = await import('@/lib/security/input-sanitizer');
    const orderId = rawOrderId ? sanitizeString(rawOrderId, 100) : null;
    const requestId = rawRequestId ? sanitizeString(rawRequestId, 100) : null;
    const remark = rawRemark ? sanitizeString(rawRemark, 500) : null;

    if (!orderId && !requestId) {
      return errorResponse(
        'INVALID_CALLBACK',
        'orderid or requestid is required',
        undefined,
        400,
      );
    }

    const supabaseAdmin = createServiceRoleClient();
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('bill_payments')
      .select('id, user_id, amount, status, reference, refunded_at, order_id, request_id, provider')
      .or(
        [
          orderId ? `order_id.eq.${orderId.replace(/'/g, "''")}` : '',
          requestId ? `request_id.eq.${requestId.replace(/'/g, "''")}` : '',
        ]
          .filter(Boolean)
          .join(','),
      )
      .maybeSingle();

    if (paymentError) {
      logError(new Error(paymentError.message), { orderId, requestId });
      return errorResponse('PAYMENT_NOT_FOUND', 'Unable to locate payment record', undefined, 404);
    }

    if (!payment) {
      return errorResponse('PAYMENT_NOT_FOUND', 'No matching payment record', undefined, 404);
    }

    const billsSettings = await getBillsSettings();
    const providerKey = payment.provider || billsSettings.defaultProvider;
    const provider = getBillsProvider(providerKey, billsSettings);

    if (!provider) {
      logError(new Error('Provider not configured for bills callback'), {
        providerKey,
      });
      return errorResponse('PROVIDER_NOT_AVAILABLE', 'Provider is not configured', undefined, 500);
    }

    const callbackResult = provider.normalizeCallback(url.searchParams);
    const metadata = {
      providerKey,
      ...Object.fromEntries(url.searchParams.entries()),
    };

    // Already processed
    if (payment.status === 'completed' && callbackResult.status === 'completed') {
      return successResponseNext({ status: 'completed' });
    }

    if (callbackResult.status === 'completed') {
      await supabaseAdmin
        .from('bill_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          order_id: callbackResult.orderId || orderId || payment.order_id,
          status_code: callbackResult.statusCode || null,
          remark: callbackResult.remark || remark || 'COMPLETED',
          metadata,
        })
        .eq('id', payment.id);

      return successResponseNext({ status: 'completed' });
    }

    if (callbackResult.status === 'processing') {
      await supabaseAdmin
        .from('bill_payments')
        .update({
          status: 'processing',
          status_code: callbackResult.statusCode || null,
          remark: callbackResult.remark || remark || 'PROCESSING',
          metadata,
        })
        .eq('id', payment.id);

      return successResponseNext({ status: 'processing' });
    }

    // Failure path
    await markPaymentAsFailed({
      supabaseAdmin,
      paymentId: payment.id,
      reason: callbackResult.remark || remark || 'ORDER_FAILED',
      details: metadata,
    });

    if (!payment.refunded_at) {
      await refundBillPayment({
        supabaseAdmin,
        userId: payment.user_id,
        amount: Number(payment.amount),
        paymentId: payment.id,
        reference: payment.reference || `bill_airtime_${payment.id}`,
      });
    }

    return successResponseNext({ status: 'failed' });
  } catch (error) {
    logError(error as Error);
    return errorResponse('CALLBACK_ERROR', 'Failed to process callback', undefined, 500);
  }
}

