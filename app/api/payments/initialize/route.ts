import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, errorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const { getSecuritySettings } = await import('@/lib/settings');
    const { apiRateLimit, apiRateWindow } = await getSecuritySettings();
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/payments/initialize',
      limit: apiRateLimit,
      window: apiRateWindow,
    });

    if (!rateLimit.allowed) {
      return errorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many payment requests. Please try again later.',
        {
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        429
      );
    }

    const body = await request.json();
    const { amount, email, userId } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid amount');
    }

    // Get payment limits from settings
    const { getPaymentLimits } = await import('@/lib/settings');
    const { minDeposit, maxDeposit } = await getPaymentLimits();
    
    // Convert amount from kobo to NGN for validation
    const amountInNGN = amount / 100;
    
    if (amountInNGN < minDeposit) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Minimum deposit amount is ₦${minDeposit}`);
    }
    
    if (amountInNGN > maxDeposit) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Maximum deposit amount is ₦${maxDeposit}`);
    }

    if (!email || typeof email !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Valid email is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'User ID is required');
    }

    // Verify user is authenticated using custom auth
    const user = await requireAuth();

    // Verify the userId matches the authenticated user
    if (user.id !== userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
    }

    // Get Paystack secret key
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      logError(new Error('PAYSTACK_SECRET_KEY is not set'));
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Payment service not configured');
    }

    // Generate unique reference
    const reference = `wagr_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Initialize Paystack transaction
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount), // Amount in kobo
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/payments/verify`,
        metadata: {
          userId,
          type: 'deposit',
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      logError(new Error(`Paystack error: ${paystackData.message}`), { paystackData });
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        paystackData.message || 'Failed to initialize payment',
        { paystackError: paystackData },
        paystackResponse.status || 500
      );
    }

    // Validate Paystack response structure
    if (!paystackData.data || !paystackData.data.authorization_url) {
      logError(new Error('Invalid Paystack response structure'), { paystackData });
      throw new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Invalid response from payment service',
        { paystackData },
        500
      );
    }

    // Don't create pending transaction - only create successful deposit when payment is verified
    return successResponseNext({
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

