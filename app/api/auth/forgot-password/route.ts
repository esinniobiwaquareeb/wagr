import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    {
      limit: 3, // 3 password reset requests per hour
      window: 3600, // 1 hour
      endpoint: '/api/auth/forgot-password',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { email } = body;

        if (!email || typeof email !== 'string') {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Email address is required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Please enter a valid email address');
        }

        const supabase = await createClient();

        // Always return success to prevent email enumeration
        // Supabase will send reset email if user exists
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app'}/reset-password`,
        });

        // Don't reveal if email exists or not for security
        return NextResponse.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent',
        });
      } catch (error) {
        logError(error as Error);
        if (error instanceof AppError) {
          return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
        }
        // Still return success to prevent email enumeration
        return NextResponse.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent',
        });
      }
    }
  );
}

