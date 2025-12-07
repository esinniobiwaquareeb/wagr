import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserId } from '@/lib/auth/session';
import { verify2FACode, verifyBackupCode } from '@/lib/two-factor';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, isBackupCode = false } = body;

    if (!code || typeof code !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Verification code is required');
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in');
    }

    const supabase = await createClient();

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('two_factor_secret, two_factor_backup_codes, two_factor_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch profile');
    }

    if (!profile.two_factor_secret) {
      throw new AppError(ErrorCode.TWO_FACTOR_NOT_ENABLED, '2FA is not set up');
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      if (!profile.two_factor_backup_codes || profile.two_factor_backup_codes.length === 0) {
        throw new AppError(ErrorCode.TWO_FACTOR_INVALID, 'No backup codes available');
      }
      isValid = verifyBackupCode(profile.two_factor_backup_codes, code);
      
      if (isValid) {
        // Remove used backup code
        const updatedCodes = profile.two_factor_backup_codes.filter(
          (c: string) => c.toUpperCase() !== code.toUpperCase().trim()
        );
        await supabase
          .from('profiles')
          .update({ two_factor_backup_codes: updatedCodes })
          .eq('id', userId);
      }
    } else {
      // Verify TOTP code
      isValid = verify2FACode(profile.two_factor_secret, code);
    }

    if (!isValid) {
      throw new AppError(ErrorCode.TWO_FACTOR_INVALID, 'Invalid verification code');
    }

    // If verifying during setup, enable 2FA
    if (!profile.two_factor_enabled) {
      const { error: enableError } = await supabase
        .from('profiles')
        .update({ two_factor_enabled: true })
        .eq('id', userId);

      if (enableError) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to enable 2FA');
      }
    }

    return successResponseNext({
      message: 'Verification successful',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

