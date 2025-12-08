import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';
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
import { getPlanFromLocalCatalog } from '@/lib/bills/local-plan-loader';

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

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    const plan = await getPlanFromLocalCatalog(network.code, body.dataPlanCode);
    if (!plan) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Selected data plan is not available.');
    }

    const planPrice = Number(plan.price);
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

    // Get balance from NestJS backend
    const balanceResponse = await nestjsServerFetch<{ balance: number; currency: string }>('/wallet/balance', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!balanceResponse.success || !balanceResponse.data) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to fetch your wallet balance.');
    }

    const currentBalance = Number(balanceResponse.data.balance || 0);
    if (currentBalance < amount) {
      throw new AppError(
        ErrorCode.INSUFFICIENT_BALANCE,
        'You do not have enough balance to complete this purchase.',
      );
    }

    const reference = `bill_data_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = `DATA-${randomUUID()}`;
    const planLabel = body.dataPlanLabel || plan.label || body.dataPlanCode;

    // Call NestJS backend to purchase data
    const purchaseResponse = await nestjsServerFetch<any>('/bills/data', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        phoneNumber: normalizedPhone,
        networkCode: network.code,
        dataPlanCode: body.dataPlanCode,
        dataPlanLabel: planLabel,
        providerKey,
      }),
    });

    if (!purchaseResponse.success || !purchaseResponse.data) {
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        purchaseResponse.error?.message || 'Failed to prepare data purchase.',
      );
    }

    // The NestJS backend handles the provider call and payment processing
    const paymentStatus = purchaseResponse.data.status || 'processing';
    const message =
      paymentStatus === 'completed'
        ? 'Data purchase completed successfully.'
        : paymentStatus === 'processing'
        ? 'Data purchase is processing. You will be notified once completed.'
        : 'Data purchase failed.';

    return successResponseNext({
      status: paymentStatus,
      orderId: purchaseResponse.data.orderId || null,
      requestId: purchaseResponse.data.requestId || requestId,
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

