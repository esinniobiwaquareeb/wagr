import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const params = new URLSearchParams();
    params.set('filter', filter);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch(`/social/activity-feed?${params.toString()}`, {
      method: 'GET',
      token,
      requireAuth: true,
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to get activity feed' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get activity feed' },
      { status: 500 },
    );
  }
}

