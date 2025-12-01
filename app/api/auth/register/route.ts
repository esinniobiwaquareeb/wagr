import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { generateEmailVerificationToken, getExpirationTime, generateUUID } from '@/lib/auth/tokens';
import { sendEmail } from '@/lib/email-service';
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
      endpoint: '/api/auth/register',
    },
    async (req) => {
      try {
        const body = await req.json();
        const { email, password, username } = body;

        // Validate input
        if (!email || typeof email !== 'string') {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Email is required');
        }

        if (!password || typeof password !== 'string') {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Password is required');
        }

        if (!username || typeof username !== 'string') {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Username is required');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          throw new AppError(ErrorCode.INVALID_INPUT, 'Please enter a valid email address');
        }

        // Validate password strength
        const { getSecuritySettings } = await import('@/lib/settings');
        const { minPasswordLength } = await getSecuritySettings();
        const passwordValidation = await validatePasswordStrength(password, minPasswordLength);
        if (!passwordValidation.valid) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, passwordValidation.error || 'Invalid password');
        }

        // Validate username
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Username must be at least 3 characters long');
        }

        if (trimmedUsername.length > 30) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Username must be less than 30 characters');
        }

        // Check for valid username format (alphanumeric, underscore, hyphen)
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!usernameRegex.test(trimmedUsername)) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Username can only contain letters, numbers, underscores, and hyphens');
        }

        const supabase = await createClient();
        const trimmedEmail = email.trim().toLowerCase();

        // Check if email already exists (use maybeSingle to handle not found gracefully)
        const { data: existingEmail, error: emailCheckError } = await supabase
          .from('profiles')
          .select('id, email_verified')
          .eq('email', trimmedEmail)
          .maybeSingle();

        // If query error (not just "not found"), handle it
        if (emailCheckError && emailCheckError.code !== 'PGRST116') {
          logError(new Error(`Error checking email: ${emailCheckError.message}`));
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to verify email availability');
        }

        // If email exists, reject registration
        if (existingEmail) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'An account with this email already exists');
        }

        // Check if username already exists (use maybeSingle to handle not found gracefully)
        const { data: existingUsername, error: usernameCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', trimmedUsername)
          .maybeSingle();

        // If query error (not just "not found"), handle it
        if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
          logError(new Error(`Error checking username: ${usernameCheckError.message}`));
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to verify username availability');
        }

        // If username exists, reject registration
        if (existingUsername) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'This username is already taken');
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Generate email verification token
        const verificationToken = await generateEmailVerificationToken();
        const expiresAt = getExpirationTime(24); // 24 hours

        // Generate UUID for user profile
        const userId = generateUUID();

        // Create user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: trimmedEmail,
            username: trimmedUsername,
            password_hash: passwordHash,
            email_verified: false,
            balance: 0,
          })
          .select()
          .single();

        if (profileError || !profile) {
          // Check for unique constraint violations
          if (profileError?.code === '23505') {
            // PostgreSQL unique constraint violation
            const detail = profileError.details || '';
            if (detail.includes('email') || profileError.message?.includes('email')) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, 'An account with this email already exists');
            }
            if (detail.includes('username') || profileError.message?.includes('username')) {
              throw new AppError(ErrorCode.VALIDATION_ERROR, 'This username is already taken');
            }
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'An account with this information already exists');
          }
          
          logError(new Error(`Failed to create profile: ${profileError?.message}`), {
            error: profileError,
            email: trimmedEmail,
            username: trimmedUsername,
          });
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to create account. Please try again.');
        }

        // Create email verification record
        const { error: verificationError } = await supabase
          .from('email_verifications')
          .insert({
            user_id: profile.id,
            token: verificationToken,
            expires_at: expiresAt.toISOString(),
          });

        if (verificationError) {
          logError(new Error(`Failed to create verification: ${verificationError.message}`));
          // Don't fail registration, but log the error
        }

        // Send verification email (synchronously for immediate delivery)
        const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';
        const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

        // Send verification email immediately (critical email)
        try {
          const emailSent = await sendEmail({
            to: trimmedEmail,
            type: 'verification',
            data: {
              recipientName: trimmedUsername,
              verificationUrl,
            },
          });

          if (!emailSent) {
            logError(new Error('Failed to send verification email - SMTP may not be configured'));
            // Don't fail registration, but log the error
            // User can request a new verification email later
          }
        } catch (emailError) {
          logError(new Error(`Error sending verification email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`));
          // Don't fail registration, but log the error
        }

        // DO NOT create session - user must verify email first, then login
        // Send welcome email will be sent after email verification

        return successResponseNext({
          message: 'Account created successfully. Please check your email to verify your account before logging in.',
          user: {
            id: profile.id,
            email: profile.email,
            username: profile.username,
            email_verified: false,
          },
        });
      } catch (error) {
        logError(error as Error);
        return appErrorToResponse(error);
      }
    }
  );
}

