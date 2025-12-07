import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserId } from '@/lib/auth/session';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { sendEmailAsync } from '@/lib/email-queue';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  // Get rate limit settings
  const { getSecuritySettings } = await import('@/lib/settings');
  const { authRateLimit, authRateWindow } = await getSecuritySettings();
  
  return withRateLimit(
    request,
    {
      limit: authRateLimit,
      window: authRateWindow,
      endpoint: '/api/auth/change-password',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Both current and new passwords are required');
        }

        // Get minimum password length from settings
        const { getSecuritySettings } = await import('@/lib/settings');
        const { minPasswordLength } = await getSecuritySettings();
        
        if (newPassword.length < minPasswordLength) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, `New password must be at least ${minPasswordLength} characters long`);
        }

        const userId = await getCurrentUserId();
        if (!userId) {
          throw new AppError(ErrorCode.UNAUTHORIZED, 'You must be logged in to change your password');
        }

        const supabase = await createClient();

        // Get user profile with password hash
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('password_hash, email, username')
          .eq('id', userId)
          .maybeSingle();

        if (profileError || !profile) {
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch profile');
        }

        // Verify current password
        const passwordMatch = await verifyPassword(currentPassword, profile.password_hash);
        if (!passwordMatch) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect');
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ password_hash: newPasswordHash })
          .eq('id', userId);

        if (updateError) {
          throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to update password. Please try again');
        }

        // Send password changed email in background (non-blocking)
        sendEmailAsync({
          to: profile.email,
          type: 'password-changed',
          data: {
            recipientName: profile.username || undefined,
            changeDate: new Date().toLocaleString(),
          },
        });

        return successResponseNext({
          message: 'Password changed successfully',
        });
      } catch (error) {
        logError(error as Error);
        return appErrorToResponse(error);
      }
    }
  );
}

