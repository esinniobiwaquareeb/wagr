import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserId } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body; // Require password confirmation

    if (!password) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Password is required to disable 2FA');
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in');
    }

    const supabase = await createClient();

    // Get user profile with password hash
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch profile');
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, profile.password_hash);
    if (!passwordMatch) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid password');
    }

    // Disable 2FA
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
      })
      .eq('id', userId);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to disable 2FA');
    }

    return successResponseNext({
      message: '2FA has been disabled',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

