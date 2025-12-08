import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-handler';

/**
 * GET /api/payments/verify
 * Proxy payment verification to NestJS backend
 * NestJS handles the verification and redirects to frontend wallet page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    const provider = searchParams.get('provider') || 'paystack';

    // Build NestJS URL
    const nestjsUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const nestjsParams = new URLSearchParams();
    if (reference) nestjsParams.set('reference', reference);
    if (trxref) nestjsParams.set('trxref', trxref);
    nestjsParams.set('provider', provider);

    // Redirect to NestJS endpoint which will handle verification and redirect to frontend
    const nestjsVerifyUrl = `${nestjsUrl}/api/v1/payments/verify?${nestjsParams.toString()}`;
    return NextResponse.redirect(nestjsVerifyUrl);
  } catch (error) {
    logError(error as Error);
    // Fallback redirect to wallet on error
    return NextResponse.redirect(new URL('/wallet?error=verification_error', request.url));
  }
}

