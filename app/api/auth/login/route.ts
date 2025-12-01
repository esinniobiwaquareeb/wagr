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
  // Get rate limit settings
  const { getSecuritySettings } = await import('@/lib/settings');
  const { authRateLimit, authRateWindow } = await getSecuritySettings();
  
  return withRateLimit(
    request,
    {
      limit: authRateLimit,
      window: authRateWindow,
      endpoint: '/api/auth/login',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { email, password, twoFactorCode, isBackupCode, rememberMe } = body;

        if (!email || !password) {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Please enter both your email and password');
        }

        const supabase = await createClient();

        // Find user by email (check deleted_at in code, not in query, to avoid query issues)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, username, password_hash, two_factor_enabled, two_factor_secret, two_factor_backup_codes, is_admin, is_suspended, email_verified, deleted_at')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();

        // Handle database errors
        if (profileError) {
          // Log the actual error for debugging with full details
          logError(new Error(`Database error in login: ${profileError.message}`), {
            error: profileError,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
            email: email.trim().toLowerCase(),
          });
          
          // Check for specific error codes
          // PGRST116 = no rows returned (this is expected for invalid credentials, handled below)
          if (profileError.code === 'PGRST116') {
            // This is actually "not found", which is fine - treat as invalid credentials
            throw new AppError(ErrorCode.INVALID_CREDENTIALS, "The email or password you entered doesn't match our records");
          }
          
          // Connection or other database errors
          throw new AppError(ErrorCode.DATABASE_ERROR, 'An error occurred while trying to log in. Please try again.');
        }

        // If no profile found, return invalid credentials
        if (!profile) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, "The email or password you entered doesn't match our records");
        }

        if (!profile.password_hash) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, "The email or password you entered doesn't match our records");
        }

        // Check if account is deleted (must check before password verification)
        if (profile.deleted_at) {
          throw new AppError(ErrorCode.ACCOUNT_DELETED, "Account deleted. Kindly contact support");
        }

        // Check if account is suspended (before password verification to prevent timing attacks)
        if (profile.is_suspended) {
          throw new AppError(ErrorCode.ACCOUNT_SUSPENDED, "Account suspended, Kindly contact support");
        }

        // Verify password
        const passwordValid = await verifyPassword(password, profile.password_hash);
        if (!passwordValid) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, "The email or password you entered doesn't match our records");
        }

        // Check if email is verified
        if (!profile.email_verified) {
          throw new AppError(ErrorCode.EMAIL_NOT_VERIFIED, 'Please verify your email address before logging in. Check your inbox for the verification link.');
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
        const shouldRememberMe = rememberMe === true;
        const sessionToken = await createSession(profile.id, clientIP, userAgent, shouldRememberMe);
        
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

        // Set session cookie on the response with rememberMe option
        return await setSessionCookie(sessionToken, response, shouldRememberMe) || response;
      } catch (error) {
        logError(error as Error);
        return appErrorToResponse(error);
      }
    }
  );
}
