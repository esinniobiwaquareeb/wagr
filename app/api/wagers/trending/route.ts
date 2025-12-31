import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '20';

    const response = await nestjsServerFetch(`/wagers/trending?limit=${limit}`, {
      method: 'GET',
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to fetch trending wagers' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    console.error('Error fetching trending wagers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending wagers', message: error.message },
      { status: 500 },
    );
  }
}
