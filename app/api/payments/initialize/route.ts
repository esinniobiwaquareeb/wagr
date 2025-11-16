import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/payments/initialize',
      limit: 20, // 20 payment initializations per hour
      window: 3600, // 1 hour
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many payment requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        }
      );
    }

    const body = await request.json();
    const { amount, email, userId } = body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid amount');
    }

    if (!email || typeof email !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Valid email is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'User ID is required');
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
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

    // Don't create pending transaction - only create successful deposit when payment is verified
    return NextResponse.json({
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference,
    });
  } catch (error) {
    logError(error as Error);
    if (error instanceof AppError) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(
      formatErrorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 'Payment initialization failed')),
      { status: 500 }
    );
  }
}

