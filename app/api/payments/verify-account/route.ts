import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent hitting Paystack's rate limits
    const { getSecuritySettings } = await import('@/lib/settings');
    const { apiRateLimit, apiRateWindow } = await getSecuritySettings();
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit({
      identifier: clientIP,
      endpoint: '/api/payments/verify-account',
      limit: Math.min(apiRateLimit, 20), // Cap at 20 for account verification
      window: Math.min(apiRateWindow, 60), // Cap at 60 seconds for account verification
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many verification requests. Please wait a moment and try again.',
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
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { success: false, error: 'Account number and bank code are required' },
        { status: 400 }
      );
    }

    // Get Paystack secret key
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return NextResponse.json(
        { success: false, error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    // Verify account with Paystack
    const resolveResponse = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const data = await resolveResponse.json();

    // Handle Paystack rate limiting (429)
    if (resolveResponse.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Payment service is temporarily unavailable. Please try again in a moment.',
        },
        { status: 429 }
      );
    }

    if (!resolveResponse.ok || !data.status) {
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Failed to verify account. Please check the account details and try again.',
        },
        { status: resolveResponse.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accountName: data.data.account_name,
    });
  } catch (error) {
    console.error('Error verifying account:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

