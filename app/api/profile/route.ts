import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url, balance, email_verified, email_verified_at, two_factor_enabled, created_at, kyc_level, kyc_level_label, bvn_verified, nin_verified, face_verified, document_verified')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch profile');
    }

    return successResponseNext({ profile });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/profile
 * Update user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const supabase = await createClient();

    const { username, avatar_url } = body;
    const updates: any = {};

    if (username !== undefined) {
      const trimmedUsername = username?.trim();
      if (!trimmedUsername || trimmedUsername.length < 3) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Username must be at least 3 characters');
      }
      if (trimmedUsername.length > 30) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Username must be less than 30 characters');
      }
      const usernameRegex = /^[a-zA-Z0-9_-]+$/;
      if (!usernameRegex.test(trimmedUsername)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Username can only contain letters, numbers, underscores, and hyphens');
      }

      // Check if username is taken
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (existing) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Username is already taken');
      }

      updates.username = trimmedUsername;
    }

    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'No fields to update');
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, username, email, avatar_url, balance, email_verified, email_verified_at, two_factor_enabled, created_at, kyc_level, kyc_level_label, bvn_verified, nin_verified, face_verified, document_verified')
      .maybeSingle();

    if (error || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update profile');
    }

    return successResponseNext({ profile });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

