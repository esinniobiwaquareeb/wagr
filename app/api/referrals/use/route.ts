import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referral_code } = body;

    if (!referral_code) {
      return NextResponse.json(
        { success: false, error: 'Referral code is required' },
        { status: 400 },
      );
    }

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch('/referrals/use', {
      method: 'POST',
      token,
      requireAuth: true,
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ referral_code }),
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to use referral code' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to use referral code' },
      { status: 500 },
    );
  }
}

