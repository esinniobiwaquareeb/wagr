import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body; // Require password confirmation

    if (!password) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Password is required to disable 2FA');
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in');
    }

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
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
      .eq('id', user.id);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to disable 2FA');
    }

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled',
    });
  } catch (error) {
    logError(error as Error);
    if (error instanceof AppError) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }
    return NextResponse.json(
      formatErrorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to disable 2FA')),
      { status: 500 }
    );
  }
}

