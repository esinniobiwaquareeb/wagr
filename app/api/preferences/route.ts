import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/preferences
 * Get user preferences
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch preferences');
    }

    // Return defaults if no preferences exist
    const defaultPreferences = {
      preferred_categories: [],
      notification_enabled: true,
      notification_types: ['wager_resolved', 'wager_ending', 'balance_update'],
      push_notifications_enabled: false,
    };

    return successResponseNext({
      preferences: preferences || defaultPreferences,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/preferences
 * Update user preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const supabase = await createClient();

    const {
      preferred_categories,
      notification_enabled,
      notification_types,
      push_notifications_enabled,
    } = body;

    const updates: any = {};

    if (preferred_categories !== undefined) {
      updates.preferred_categories = preferred_categories;
    }
    if (notification_enabled !== undefined) {
      updates.notification_enabled = notification_enabled;
    }
    if (notification_types !== undefined) {
      updates.notification_types = notification_types;
    }
    if (push_notifications_enabled !== undefined) {
      updates.push_notifications_enabled = push_notifications_enabled;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'No fields to update');
    }

    // Upsert preferences
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...updates,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .maybeSingle();

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update preferences');
    }

    return successResponseNext({ preferences });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

