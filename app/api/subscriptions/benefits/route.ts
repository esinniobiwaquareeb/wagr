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

    // Return in the format expected by apiGet: { data: { ...benefits } }
    return NextResponse.json({
      success: true,
      data: response.data || {},
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get benefits' },
      { status: 500 },
    );
  }
}

