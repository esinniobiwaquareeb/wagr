import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generate2FASecret } from '@/lib/two-factor';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in to enable 2FA');
    }

    // Check if 2FA is already enabled
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('two_factor_enabled, two_factor_secret')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch profile');
    }

    if (profile?.two_factor_enabled) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '2FA is already enabled');
    }

    // Generate 2FA secret
    const setup = await generate2FASecret(user.email || 'user', 'wagr');

    // Store secret temporarily (user needs to verify before enabling)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        two_factor_secret: setup.secret,
        two_factor_backup_codes: setup.backupCodes,
      })
      .eq('id', user.id);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to save 2FA secret');
    }

    return NextResponse.json({
      success: true,
      secret: setup.secret,
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes,
    });
  } catch (error) {
    logError(error as Error);
    if (error instanceof AppError) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(
      formatErrorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to setup 2FA')),
      { status: 500 }
    );
  }
}

