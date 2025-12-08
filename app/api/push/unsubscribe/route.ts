import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { cookies } from 'next/headers';

/**
 * API endpoint to delete push notification subscription
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    // Validate subscription structure
    if (typeof subscription.endpoint !== 'string' || subscription.endpoint.length < 10) {
      return NextResponse.json(
        { error: 'Invalid subscription endpoint' },
        { status: 400 }
      );
    }

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch('/notifications/push/unsubscribe', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
        },
      }),
    });

    if (!response.success) {
      return NextResponse.json(
        { error: response.error?.message || 'Failed to delete subscription' },
        { status: response.error?.statusCode || 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

