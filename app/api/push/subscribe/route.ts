import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { logger } from '@/lib/logger';

/**
 * API endpoint to save push notification subscription
 */
export async function POST(request: NextRequest) {
  try {
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

    // Get authenticated user
    const user = await requireAuth();
    const supabase = await createClient();

    // Save subscription to database
    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint',
      });

    if (dbError) {
      logger.error('Error saving push subscription:', dbError);
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in push subscribe endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

