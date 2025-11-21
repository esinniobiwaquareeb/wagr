import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie, deleteAllUserSessions } from '@/lib/auth/session';
import { verify2FACode, verifyBackupCode } from '@/lib/two-factor';
import { markSessionAs2FAVerified } from '@/lib/session-2fa';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';
import { getClientIP } from '@/lib/rate-limit';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    {
      limit: 5, // 5 login attempts per 15 minutes
      window: 900, // 15 minutes
      endpoint: '/api/auth/login',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { email, password, twoFactorCode, isBackupCode } = body;

        if (!email || !password) {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Please enter both your email and password');
        }

        const supabase = await createClient();

        // Find user by email
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, username, password_hash, two_factor_enabled, two_factor_secret, two_factor_backup_codes, is_admin')
          .eq('email', email.trim().toLowerCase())
          .single();

        if (profileError || !profile) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, "The email or password you entered doesn't match our records");
        }

        if (!profile.password_hash) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, "The email or password you entered doesn't match our records");
        }

        // Verify password
        const passwordValid = await verifyPassword(password, profile.password_hash);
        if (!passwordValid) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, "The email or password you entered doesn't match our records");
        }

        // Check if 2FA is enabled
        if (profile.two_factor_enabled) {
          if (!twoFactorCode) {
            // Return 2FA required (don't create session yet)
            return successResponseNext({
              requires2FA: true,
              message: 'Please enter the code from your authenticator app to continue',
            });
          }

          // Verify 2FA code
          let isValid = false;
          if (isBackupCode) {
            if (!profile.two_factor_backup_codes || profile.two_factor_backup_codes.length === 0) {
              throw new AppError(ErrorCode.TWO_FACTOR_INVALID, "That backup code doesn't look right. Please check and try again");
            }
            isValid = verifyBackupCode(profile.two_factor_backup_codes, twoFactorCode);
            
            if (isValid) {
              // Remove used backup code
              const updatedCodes = profile.two_factor_backup_codes.filter(
                (c: string) => c.toUpperCase() !== twoFactorCode.toUpperCase().trim()
              );
              await supabase
                .from('profiles')
                .update({ two_factor_backup_codes: updatedCodes })
                .eq('id', profile.id);
            }
          } else {
            if (!profile.two_factor_secret) {
              throw new AppError(ErrorCode.TWO_FACTOR_INVALID, "We couldn't verify your security settings. Please contact support");
            }
            isValid = verify2FACode(profile.two_factor_secret, twoFactorCode);
          }

          if (!isValid) {
            throw new AppError(ErrorCode.TWO_FACTOR_INVALID, "That code doesn't match. Make sure you're using the latest code from your authenticator app");
          }
        }

        // Check if user is admin - admins should use admin login
        if (profile.is_admin) {
          // For now, allow admin login here, but you can redirect to admin login if needed
          // return NextResponse.json(
          //   { error: 'Admins must use the admin login page' },
          //   { status: 403 }
          // );
        }

        // Create session
        const clientIP = getClientIP(req);
        const userAgent = req.headers.get('user-agent') || undefined;
        const sessionToken = await createSession(profile.id, clientIP, userAgent);
        
        // Create response first
        const response = successResponseNext({
          user: {
            id: profile.id,
            email: profile.email,
            username: profile.username,
            is_admin: profile.is_admin || false,
          },
          requires2FA: profile.two_factor_enabled && !twoFactorCode ? true : undefined,
          twoFactorVerified: profile.two_factor_enabled && twoFactorCode ? true : undefined,
        });

        // Set session cookie on the response
        return await setSessionCookie(sessionToken, response) || response;
      } catch (error) {
        logError(error as Error);
        return appErrorToResponse(error);
      }
    }
  );
}
