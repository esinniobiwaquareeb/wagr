import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-handler';

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Call NestJS backend webhook handler directly
    // Note: NestJS expects raw body for signature verification
    const response = await fetch(`${NESTJS_API_BASE}/payments/webhook/paystack`, {
      method: 'POST',
      headers: {
        'x-paystack-signature': signature,
        'content-type': 'application/json',
      },
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Webhook processing failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data || { status: 'success' });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

