import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    {
      limit: 5, // 5 password change attempts per 15 minutes
      window: 900, // 15 minutes
      endpoint: '/api/auth/change-password',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Both current and new passwords are required');
        }

        if (newPassword.length < 6) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'New password must be at least 6 characters long');
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || !user.email) {
          throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in to change your password');
        }

        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInError) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect');
        }

        // Update password
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to update password. Please try again');
        }

        // Send password changed email
        try {
          const { generateEmailHTML, generateEmailText, getEmailSubject } = await import('@/lib/email-templates');
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();

          const emailData = {
            type: 'password-changed' as const,
            recipientEmail: user.email,
            recipientName: profile?.username || undefined,
            changeDate: new Date().toLocaleString(),
          };

          // Note: In production, you'd send this via your email service
          // For now, Supabase handles password change notifications automatically
          // This template can be used if you set up custom email sending
        } catch (emailError) {
          // Log but don't fail the password change
          logError(emailError as Error);
        }

        return NextResponse.json({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (error) {
        logError(error as Error);
        if (error instanceof AppError) {
          return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
        }
        return NextResponse.json(
          formatErrorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to change password. Please try again')),
          { status: 500 }
        );
      }
    }
  );
}

