import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verify2FACode, verifyBackupCode } from '@/lib/two-factor';
import { AppError, formatErrorResponse, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { withRateLimit } from '@/lib/middleware-rate-limit';

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
          throw new AppError(ErrorCode.INVALID_INPUT, 'Email and password are required');
        }

        const supabase = await createClient();

        // Attempt login
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError || !authData.user) {
          throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
        }

        // Check if user has 2FA enabled
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('two_factor_enabled, two_factor_secret, two_factor_backup_codes')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch user profile');
        }

        // If 2FA is enabled, ALWAYS require verification on login
        // This ensures 2FA is required on every new login, not just the first time
        if (profile?.two_factor_enabled) {
          if (!twoFactorCode) {
            // Sign out and return 2FA required
            await supabase.auth.signOut();
            return NextResponse.json(
              {
                requires2FA: true,
                message: 'Two-factor authentication is required',
              },
              { status: 200 }
            );
          }

          // Verify 2FA code
          let isValid = false;
          if (isBackupCode) {
            if (!profile.two_factor_backup_codes || profile.two_factor_backup_codes.length === 0) {
              await supabase.auth.signOut();
              throw new AppError(ErrorCode.TWO_FACTOR_INVALID, 'Invalid backup code');
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
                .eq('id', authData.user.id);
            }
          } else {
            if (!profile.two_factor_secret) {
              await supabase.auth.signOut();
              throw new AppError(ErrorCode.TWO_FACTOR_INVALID, '2FA secret not found');
            }
            isValid = verify2FACode(profile.two_factor_secret, twoFactorCode);
          }

          if (!isValid) {
            await supabase.auth.signOut();
            throw new AppError(ErrorCode.TWO_FACTOR_INVALID, 'Invalid verification code');
          }
          
          // Mark that 2FA was verified for this login session
          // We'll return a flag that the client can use to mark the session
          return NextResponse.json({
            success: true,
            user: {
              id: authData.user.id,
              email: authData.user.email,
            },
            twoFactorVerified: true, // Flag to indicate 2FA was verified
          });
        }

        return NextResponse.json({
          success: true,
          user: {
            id: authData.user.id,
            email: authData.user.email,
          },
        });
      } catch (error) {
        logError(error as Error);
        if (error instanceof AppError) {
          return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
        }
        return NextResponse.json(
          formatErrorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 'Login failed')),
          { status: 500 }
        );
      }
    }
  );
}

