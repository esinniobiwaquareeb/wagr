/**
 * Password hashing and verification utilities
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * @param password Password to validate
 * @param minLength Optional minimum length (defaults to 8 from settings)
 */
export async function validatePasswordStrength(password: string, minLength?: number): Promise<{ valid: boolean; error?: string }> {
  // Get min password length from settings if not provided
  if (minLength === undefined) {
    const { getSecuritySettings } = await import('@/lib/settings');
    const { minPasswordLength } = await getSecuritySettings();
    minLength = minPasswordLength;
  }

  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters long` };
  }

  if (password.length > 72) {
    return { valid: false, error: 'Password must be less than 72 characters' };
  }

  return { valid: true };
}

