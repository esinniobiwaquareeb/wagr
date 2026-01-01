import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';
import { logError } from '@/lib/error-handler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    
    if (!challengeId) {
      return NextResponse.json(
        { success: false, error: 'Challenge ID is required' },
        { status: 400 }
      );
    }

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    const response = await nestjsServerFetch(`/gamification/challenges/${challengeId}/claim`, {
      method: 'POST',
      token,
      requireAuth: true,
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error?.message || 'Failed to claim reward' },
        { status: response.error?.statusCode || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: (response.data as any)?.message || 'Reward claimed successfully',
    });
  } catch (error: any) {
    logError(error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to claim reward' },
      { status: 500 },
    );
  }
}

