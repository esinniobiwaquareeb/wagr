import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserId } from '@/lib/auth/session';
import { generate2FASecret } from '@/lib/two-factor';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in to enable 2FA');
    }

    const supabase = await createClient();

    // Get user email for 2FA setup
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, two_factor_enabled, two_factor_secret')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch profile');
    }

    if (profile.two_factor_enabled) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '2FA is already enabled');
    }

    // Generate 2FA secret
    const setup = await generate2FASecret(profile.email || 'user', 'wagr');

    // Store secret temporarily (user needs to verify before enabling)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        two_factor_secret: setup.secret,
        two_factor_backup_codes: setup.backupCodes,
      })
      .eq('id', userId);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to save 2FA secret');
    }

    return successResponseNext({
      secret: setup.secret,
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

