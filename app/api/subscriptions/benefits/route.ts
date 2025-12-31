import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';

export async function GET(request: NextRequest) {
  try {
    const response = await nestjsServerFetch('/subscriptions/benefits', {
      method: 'GET',
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to get benefits' },
        { status: 500 },
      );
    }

    return NextResponse.json(response.data || response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get benefits' },
      { status: 500 },
    );
  }
}

