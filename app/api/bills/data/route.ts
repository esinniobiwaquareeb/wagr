import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { successResponseNext, appErrorToResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';
import { getSecuritySettings, getBillsSettings } from '@/lib/settings';
import {
  getNetworkByCode,
  getNetworkById,
  normalizePhoneNumber,
  isValidNigerianPhoneNumber,
} from '@/lib/bills/networks';
import { getBillsProvider } from '@/lib/bills/providers';
import { markPaymentAsFailed, refundBillPayment } from '@/lib/bills/payment-helpers';

interface DataRequestBody {
  category: 'data';
  phoneNumber: string;
  amount: number;
  networkCode?: string;
  networkId?: string;
  dataPlanCode: string;
  dataPlanLabel?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { apiRateLimit, apiRateWindow } = await getSecuritySettings();
    const clientIP = getClientIP(request);

    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/bills/data',
      limit: apiRateLimit,
      window: apiRateWindow,
    });

    if (!rateLimit.allowed) {
      return errorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many data purchase requests. Please try again later.',
        {
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        429,
      );
    }

    const user = await requireAuth();
    const body = (await request.json()) as DataRequestBody;

    if (!body || body.category !== 'data') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Only data purchases are supported by this route.');
    }

    const billsSettings = await getBillsSettings();

    if (!billsSettings.billsEnabled || !billsSettings.dataEnabled) {
      throw new AppError(ErrorCode.NOT_IMPLEMENTED, 'Data purchases are currently disabled.');
    }

    const providerKey = (billsSettings.defaultProvider || 'nellobyte').toLowerCase();
    if (!billsSettings.enabledProviders.includes(providerKey)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        'The requested bills provider is not enabled.',
      );
    }

    const provider = getBillsProvider(providerKey, billsSettings);
    if (!provider || !provider.supports.data || !provider.purchaseData) {
      logError(new Error('Bills provider not configured for data'), { providerKey });
      throw new AppError(
        ErrorCode.NOT_IMPLEMENTED,
        'Selected bills provider is not available right now.',
      );
    }

    const normalizedPhone = normalizePhoneNumber(body.phoneNumber);
    if (!isValidNigerianPhoneNumber(normalizedPhone)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Enter a valid Nigerian phone number (11 digits, e.g. 08012345678).',
      );
    }

    let network =
      (body.networkCode && getNetworkByCode(body.networkCode)) ||
      (body.networkId && getNetworkById(body.networkId));

    if (!network) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Unable to determine the mobile network. Please select a network and try again.',
      );
    }

    if (!billsSettings.allowedNetworkCodes.includes(network.code)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `${network.name} is not currently supported.`,
      );
    }

    if (!body.dataPlanCode) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Please select a data plan.');
    }

    const supabaseAdmin = createServiceRoleClient();
    const { data: planRecord, error: planError } = await supabaseAdmin
      .from('data_plans')
      .select('plan_label, plan_price')
      .eq('network_code', network.code)
      .eq('plan_code', body.dataPlanCode)
      .eq('is_active', true)
      .single();

    if (planError || !planRecord) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Selected data plan is not available.');
    }

    const planPrice = Number(planRecord.plan_price);
    if (Number.isNaN(planPrice) || planPrice <= 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Data plan price is invalid.');
    }

    const amount = planPrice;
    if (amount < billsSettings.dataMinAmount || amount > billsSettings.dataMaxAmount) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Selected plan amount is outside permitted limits.',
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to fetch your wallet balance.');
    }

    const currentBalance = Number(profile.balance || 0);
    if (currentBalance < amount) {
      throw new AppError(
        ErrorCode.INSUFFICIENT_BALANCE,
        'You do not have enough balance to complete this purchase.',
      );
    }

    const reference = `bill_data_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = `DATA-${randomUUID()}`;

    const planLabel = body.dataPlanLabel || planRecord.plan_label || body.dataPlanCode;

    const { data: billPaymentRecord, error: billPaymentError } = await supabaseAdmin
      .from('bill_payments')
      .insert({
        user_id: user.id,
        category: 'data',
        provider: providerKey,
        amount,
        phone_number: normalizedPhone,
        network_code: network.code,
        network_name: network.name,
        data_plan_code: body.dataPlanCode,
        data_plan_label: planLabel || null,
        request_id: requestId,
        reference,
        status: 'pending',
        metadata: {
          network: network.name,
          initiated_by: user.id,
          data_plan_label: planLabel,
        },
      })
      .select('id')
      .single();

    if (billPaymentError || !billPaymentRecord) {
      logError(new Error('bill_payments insert failed (data)'), {
        error: billPaymentError,
        userId: user.id,
        providerKey,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to prepare data purchase.');
    }

    const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'bill_data',
      amount: -amount,
      reference,
      description: `Data purchase (${planLabel}) for ${normalizedPhone}`,
    });

    if (transactionError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to record data transaction.');
    }

    const { error: balanceError } = await supabaseAdmin.rpc('increment_balance', {
      user_id: user.id,
      amt: -amount,
    });

    if (balanceError) {
      logError(new Error(balanceError.message), {
        userId: user.id,
        amount,
        reference,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to debit your wallet.');
    }

    let providerResult;
    try {
      providerResult = await provider.purchaseData({
        amount,
        phoneNumber: normalizedPhone,
        networkCode: network.code,
        networkName: network.name,
        dataPlanCode: body.dataPlanCode,
        dataPlanLabel: planLabel,
        requestId,
        clientReference: reference,
      });
    } catch (providerError) {
      await markPaymentAsFailed({
        supabaseAdmin,
        paymentId: billPaymentRecord.id,
        reason: `${providerKey} data request failed`,
        details: { error: providerError instanceof Error ? providerError.message : providerError },
      });
      await refundBillPayment({
        supabaseAdmin,
        userId: user.id,
        amount,
        paymentId: billPaymentRecord.id,
        reference,
      });
      throw new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Failed to reach data provider. Your funds have been returned.',
      );
    }

    const paymentStatus = providerResult.status;

    const paymentUpdate: Record<string, any> = {
      status: paymentStatus,
      status_code: providerResult.providerStatusCode || null,
      remark:
        providerResult.providerStatus ||
        providerResult.message ||
        `Processed via ${provider.label}`,
      order_id: providerResult.orderId || null,
      metadata: {
        providerKey,
        providerResponse: providerResult.rawResponse,
        data_plan_label: planLabel,
      },
    };

    const now = new Date().toISOString();
    if (paymentStatus === 'completed') {
      paymentUpdate.completed_at = now;
    }
    if (paymentStatus === 'failed') {
      paymentUpdate.failed_at = now;
    }

    await supabaseAdmin
      .from('bill_payments')
      .update(paymentUpdate)
      .eq('id', billPaymentRecord.id);

    if (paymentStatus === 'failed') {
      await refundBillPayment({
        supabaseAdmin,
        userId: user.id,
        amount,
        paymentId: billPaymentRecord.id,
        reference,
      });
      throw new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Data purchase failed. Your balance has been refunded.',
      );
    }

    const message =
      paymentStatus === 'completed'
        ? 'Data purchase completed successfully.'
        : paymentStatus === 'processing'
        ? 'Data purchase is processing. You will be notified once completed.'
        : 'Data purchase failed.';

    return successResponseNext({
      status: paymentStatus,
      orderId: providerResult.orderId,
      requestId,
      amount,
      phoneNumber: normalizedPhone,
      network: network.name,
      plan: planLabel,
      message,
      provider: providerKey,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

