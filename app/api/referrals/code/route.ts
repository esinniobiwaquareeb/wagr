import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch('/referrals/code', {
      method: 'GET',
      token,
      requireAuth: true,
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to get referral code' },
        { status: 500 },
      );
    }

    // Return in the format expected by apiGet: { data: { referral_code: string } }
    return NextResponse.json({
      success: true,
      data: response.data || { referral_code: null },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get referral code' },
      { status: 500 },
    );
  }
}

