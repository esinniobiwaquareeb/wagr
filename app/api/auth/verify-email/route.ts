import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmailAsync } from '@/lib/email-queue';
import { sendEmail } from '@/lib/email-service';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  // Get rate limit settings
  const { getSecuritySettings } = await import('@/lib/settings');
  const { authRateLimit, authRateWindow } = await getSecuritySettings();
  
  return withRateLimit(
    request,
    {
      limit: authRateLimit,
      window: authRateWindow,
      endpoint: '/api/auth/verify-email',
    },
    async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Verification token is required');
        }

        const supabase = await createClient();

        // Find verification record
        const { data: verification, error: verificationError } = await supabase
          .from('email_verifications')
          .select('*, profiles(*)')
          .eq('token', token)
          .maybeSingle();

        // Handle database errors
        if (verificationError) {
          // PGRST116 = no rows returned (expected for invalid token)
          if (verificationError.code === 'PGRST116') {
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid or expired verification token');
          }
          // Other database errors
          logError(new Error(`Database error in verify-email: ${verificationError.message}`), {
            error: verificationError,
            code: verificationError.code,
          });
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to verify email. Please try again.');
        }

        if (!verification) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid or expired verification token');
        }

        // Check if already verified
        if (verification.verified_at) {
          return successResponseNext({
            message: 'Email already verified',
            alreadyVerified: true,
          });
        }

        // Check if expired
        if (new Date(verification.expires_at) < new Date()) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Verification token has expired. Please request a new verification email.');
        }

        // Mark email as verified
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email_verified: true,
            email_verified_at: new Date().toISOString(),
          })
          .eq('id', verification.user_id);

        if (updateError) {
          logError(new Error(`Failed to verify email: ${updateError.message}`));
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to verify email. Please try again.');
        }

        // Mark verification as used
        await supabase
          .from('email_verifications')
          .update({ verified_at: new Date().toISOString() })
          .eq('id', verification.id);

        // Send welcome email in background (non-blocking)
        const profile = verification.profiles as any;
        if (profile && profile.email) {
          sendEmailAsync({
            to: profile.email,
            type: 'welcome',
            data: {
              recipientName: profile.username || undefined,
            },
          });
        }

        // DO NOT create session - user must login after verification
        // This ensures proper authentication flow: register -> verify -> login
        return successResponseNext({
          message: 'Email verified successfully! Please log in to access your account.',
          verified: true,
        });
      } catch (error) {
        logError(error as Error);
        return appErrorToResponse(error);
      }
    }
  );
}

/**
 * Resend verification email
 */
export async function POST(request: NextRequest) {
  // Get rate limit settings
  const { getSecuritySettings } = await import('@/lib/settings');
  const { authRateLimit, authRateWindow } = await getSecuritySettings();
  
  return withRateLimit(
    request,
    {
      limit: Math.min(authRateLimit, 3), // Cap at 3 for resend requests
      window: authRateWindow,
      endpoint: '/api/auth/verify-email',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { email } = body;

        if (!email || typeof email !== 'string') {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Email is required');
        }

        const supabase = await createClient();

        // Find user
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, username, email_verified')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();

        // Handle database errors - don't reveal if email exists for security
        if (profileError) {
          // PGRST116 = no rows returned (expected for non-existent email)
          if (profileError.code === 'PGRST116') {
            return successResponseNext({
              message: 'If an account with that email exists and is not verified, a verification email has been sent.',
            });
          }
          // Other database errors - log but don't reveal
          logError(new Error(`Database error in resend verification: ${profileError.message}`), {
            error: profileError,
            code: profileError.code,
          });
          return successResponseNext({
            message: 'If an account with that email exists and is not verified, a verification email has been sent.',
          });
        }

        if (!profile) {
          // Don't reveal if email exists for security
          return successResponseNext({
            message: 'If an account with that email exists and is not verified, a verification email has been sent.',
          });
        }

        // If already verified, don't send
        if (profile.email_verified) {
          return successResponseNext({
            message: 'Email is already verified.',
          });
        }

        // Generate new verification token
        const { generateEmailVerificationToken, getExpirationTime } = await import('@/lib/auth/tokens');
        const verificationToken = await generateEmailVerificationToken();
        const expiresAt = getExpirationTime(24);

        // Create new verification record
        await supabase
          .from('email_verifications')
          .insert({
            user_id: profile.id,
            token: verificationToken,
            expires_at: expiresAt.toISOString(),
          });

        // Send verification email (synchronously for immediate delivery)
        const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';
        const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

        // Send verification email immediately (critical email)
        try {
          const emailSent = await sendEmail({
            to: profile.email,
            type: 'verification',
            data: {
              recipientName: profile.username || undefined,
              verificationUrl,
            },
          });

          if (!emailSent) {
            logError(new Error('Failed to send verification email - SMTP may not be configured'));
            // Still return success to avoid revealing if email exists
          }
        } catch (emailError) {
          logError(new Error(`Error sending verification email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`));
          // Still return success to avoid revealing if email exists
        }

        return successResponseNext({
          message: 'If an account with that email exists and is not verified, a verification email has been sent.',
        });
      } catch (error) {
        logError(error as Error);
        return appErrorToResponse(error);
      }
    }
  );
}

