import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePasswordResetToken, getExpirationTime } from '@/lib/auth/tokens';
import { sendEmail } from '@/lib/email-service';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

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

        // Find user by email
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, username')
          .eq('email', email.trim().toLowerCase())
          .single();

        // Always return success to prevent email enumeration
        if (profileError || !profile) {
          return successResponseNext({
            message: 'If an account with that email exists, a password reset link has been sent',
          });
        }

        // Generate reset token
        const resetToken = await generatePasswordResetToken();
        const expiresAt = getExpirationTime(1); // 1 hour

        // Create password reset record
        await supabase
          .from('password_resets')
          .insert({
            user_id: profile.id,
            token: resetToken,
            expires_at: expiresAt.toISOString(),
          });

        // Send password reset email
        const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';
        const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

        try {
          await sendEmail({
            to: profile.email,
            type: 'password-reset',
            data: {
              recipientName: profile.username || undefined,
              resetUrl,
            },
          });
        } catch (emailError) {
          logError(emailError as Error);
          // Don't fail the request if email fails
        }

        // Don't reveal if email exists or not for security
        return successResponseNext({
          message: 'If an account with that email exists, a password reset link has been sent',
        });
      } catch (error) {
        logError(error as Error);
        // Still return success to prevent email enumeration
        return successResponseNext({
          message: 'If an account with that email exists, a password reset link has been sent',
        });
      }
    }
  );
}
