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
  detectNetworkFromPhone,
  normalizePhoneNumber,
  isValidNigerianPhoneNumber,
} from '@/lib/bills/networks';
import { markPaymentAsFailed, refundBillPayment } from '@/lib/bills/payment-helpers';
import { getBillsProvider } from '@/lib/bills/providers';

interface AirtimeRequestBody {
  category: 'airtime';
  phoneNumber: string;
  amount: number;
  networkCode?: string;
  networkId?: string;
  bonusType?: string | null;
  providerKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { apiRateLimit, apiRateWindow } = await getSecuritySettings();
    const clientIP = getClientIP(request);

    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/bills/airtime',
      limit: apiRateLimit,
      window: apiRateWindow,
    });

    if (!rateLimit.allowed) {
      return errorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many airtime requests. Please try again later.',
        {
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        429,
      );
    }

    const user = await requireAuth();
    const body = (await request.json()) as AirtimeRequestBody;

    if (!body || body.category !== 'airtime') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Only airtime purchases are supported right now.');
    }

    const billsSettings = await getBillsSettings();

    if (!billsSettings.billsEnabled || !billsSettings.airtimeEnabled) {
      throw new AppError(ErrorCode.NOT_IMPLEMENTED, 'Airtime purchases are currently disabled.');
    }

    const providerKey = (body.providerKey || billsSettings.defaultProvider || 'nellobyte').toLowerCase();

    if (!billsSettings.enabledProviders.includes(providerKey)) {
      logError(
        new Error('Attempted to use disabled bills provider'),
        { providerKey, enabledProviders: billsSettings.enabledProviders },
      );
      throw new AppError(ErrorCode.INVALID_INPUT, 'The requested bills provider is not enabled.');
    }

    const provider = getBillsProvider(providerKey, billsSettings);
    if (!provider || !provider.supports.airtime) {
      logError(
        new Error('Bills provider not configured'),
        { providerKey },
      );
      throw new AppError(
        ErrorCode.NOT_IMPLEMENTED,
        'Selected bills provider is not available right now.',
      );
    }

    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Amount must be a positive number.');
    }

    if (amount < billsSettings.minAmount) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Minimum airtime purchase is ₦${billsSettings.minAmount.toLocaleString()}.`,
      );
    }

    if (amount > billsSettings.maxAmount) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Maximum airtime purchase is ₦${billsSettings.maxAmount.toLocaleString()}.`,
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
      (body.networkId && getNetworkById(body.networkId)) ||
      detectNetworkFromPhone(normalizedPhone);

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

    const bonusType = body.bonusType || billsSettings.defaultBonusType || undefined;

    const supabaseAdmin = createServiceRoleClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance, username')
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

    const reference = `bill_airtime_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = `AIRTIME-${randomUUID()}`;

    const { data: billPaymentRecord, error: billPaymentError } = await supabaseAdmin
      .from('bill_payments')
      .insert({
        user_id: user.id,
        category: 'airtime',
        provider: providerKey,
        amount,
        phone_number: normalizedPhone,
        network_code: network.code,
        network_name: network.name,
        bonus_type: bonusType || null,
        request_id: requestId,
        reference,
        status: 'pending',
        metadata: {
          network: network.name,
          initiated_by: user.id,
        },
      })
      .select('id')
      .single();

    if (billPaymentError || !billPaymentRecord) {
      logError(new Error('bill_payments insert failed'), {
        error: billPaymentError,
        userId: user.id,
        providerKey,
      });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to prepare airtime purchase.');
    }

    const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      type: 'bill_airtime',
      amount: -amount,
      reference,
      description: `Airtime purchase for ${normalizedPhone} (${network.name})`,
    });

    if (transactionError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to record airtime transaction.');
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
      providerResult = await provider.purchaseAirtime({
        amount,
        phoneNumber: normalizedPhone,
        networkCode: network.code,
        networkName: network.name,
        bonusType,
        clientReference: reference,
        requestId,
      });
    } catch (providerError) {
      await markPaymentAsFailed({
        supabaseAdmin,
        paymentId: billPaymentRecord.id,
        reason: `${providerKey} request failed`,
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
        'Failed to reach airtime provider. Your funds have been returned.',
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
        'Airtime purchase failed. Your balance has been refunded.',
      );
    }

    const message =
      paymentStatus === 'completed'
        ? 'Airtime purchase completed successfully.'
        : paymentStatus === 'processing'
        ? 'Airtime purchase is processing. You will be notified once completed.'
        : 'Airtime purchase failed.';

    return successResponseNext({
      status: paymentStatus,
      orderId: providerResult.orderId,
      requestId,
      amount,
      phoneNumber: normalizedPhone,
      network: network.name,
      message,
      provider: providerKey,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}


