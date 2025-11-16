import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verify2FACode, verifyBackupCode } from '@/lib/two-factor';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, isBackupCode = false } = body;

    if (!code || typeof code !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Verification code is required');
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('two_factor_secret, two_factor_backup_codes, two_factor_enabled')
      .eq('id', user.id)
      .single();

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
          .eq('id', user.id);
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
        .eq('id', user.id);

      if (enableError) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to enable 2FA');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
    });
  } catch (error) {
    logError(error as Error);
    if (error instanceof AppError) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(
      formatErrorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 'Verification failed')),
      { status: 500 }
    );
  }
}

