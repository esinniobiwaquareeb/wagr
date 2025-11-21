import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { sendEmailAsync } from '@/lib/email-queue';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    {
      limit: 5, // 5 password reset attempts per hour
      window: 3600,
      endpoint: '/api/auth/reset-password',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { token, password } = body;

        if (!token || typeof token !== 'string') {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Reset token is required');
        }

        if (!password || typeof password !== 'string') {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Password is required');
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, passwordValidation.error || 'Invalid password');
        }

        const supabase = await createClient();

        // Find password reset record
        const { data: resetRecord, error: resetError } = await supabase
          .from('password_resets')
          .select('*, profiles(*)')
          .eq('token', token)
          .single();

        if (resetError || !resetRecord) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid or expired reset token');
        }

        // Check if already used
        if (resetRecord.used_at) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'This reset link has already been used');
        }

        // Check if expired
        if (new Date(resetRecord.expires_at) < new Date()) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Reset token has expired. Please request a new password reset.');
        }

        // Hash new password
        const passwordHash = await hashPassword(password);

        // Update user password
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ password_hash: passwordHash })
          .eq('id', resetRecord.user_id);

        if (updateError) {
          logError(new Error(`Failed to update password: ${updateError.message}`));
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to reset password. Please try again.');
        }

        // Mark reset token as used
        await supabase
          .from('password_resets')
          .update({ used_at: new Date().toISOString() })
          .eq('id', resetRecord.id);

        // Send password changed email in background (non-blocking)
        const profile = resetRecord.profiles as any;
        if (profile && profile.email) {
          sendEmailAsync({
            to: profile.email,
            type: 'password-changed',
            data: {
              recipientName: profile.username || undefined,
              changeDate: new Date().toLocaleString(),
            },
          });
        }

        return successResponseNext({
          message: 'Password reset successfully. You can now log in with your new password.',
        });
      } catch (error) {
        logError(error as Error);
        return appErrorToResponse(error);
      }
    }
  );
}

