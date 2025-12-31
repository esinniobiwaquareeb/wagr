import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

export async function DELETE(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch('/subscriptions/cancel', {
      method: 'DELETE',
      token,
      requireAuth: true,
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to cancel subscription' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel subscription' },
      { status: 500 },
    );
  }
}

