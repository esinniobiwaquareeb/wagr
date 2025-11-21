import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { sendEmailAsync } from '@/lib/email-queue';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';
import { getClientIP } from '@/lib/rate-limit';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    {
      limit: 10, // 10 verification attempts per hour
      window: 3600,
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
          .single();

        if (verificationError || !verification) {
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

        // Check if user already has a session (from registration)
        // If not, create one for auto-login
        const clientIP = getClientIP(req);
        const userAgent = req.headers.get('user-agent') || undefined;
        let hasSession = false;
        
        try {
          // Try to create a session for auto-login
          const sessionToken = await createSession(verification.user_id, clientIP, userAgent);
          hasSession = true;
          
          // Create response with session cookie
          const response = successResponseNext({
            message: 'Email verified successfully! Welcome to wagr!',
            hasSession: true,
          });
          
          return await setSessionCookie(sessionToken, response) || response;
        } catch (sessionError) {
          // If session creation fails, user can still login manually
          logError(sessionError as Error);
        }

        return successResponseNext({
          message: 'Email verified successfully! Welcome to wagr!',
          hasSession: false,
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
  return withRateLimit(
    request,
    {
      limit: 3, // 3 resend requests per hour
      window: 3600,
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
          .single();

        if (profileError || !profile) {
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

        // Send verification email
        const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://wagr.app';
        const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

        // Send verification email in background (non-blocking)
        sendEmailAsync({
          to: profile.email,
          type: 'verification',
          data: {
            recipientName: profile.username || undefined,
            verificationUrl,
          },
        });

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

