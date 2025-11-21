/**
 * Token generation utilities for email verification and password reset
 * Uses Web Crypto API for Edge Runtime compatibility
 */

/**
 * Generate a secure random token using Web Crypto API
 */
export async function generateToken(length: number = 32): Promise<string> {
  const array = new Uint8Array(length);
  
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Web Crypto API is not available');
  }
  
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate email verification token
 */
export async function generateEmailVerificationToken(): Promise<string> {
  return generateToken(32);
}

/**
 * Generate password reset token
 */
export async function generatePasswordResetToken(): Promise<string> {
  return generateToken(32);
}

/**
 * Calculate expiration time
 */
export function getExpirationTime(hours: number = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Generate a UUID v4 using Web Crypto API
 */
export function generateUUID(): string {
  const array = new Uint8Array(16);
  
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Web Crypto API is not available');
  }
  
  crypto.getRandomValues(array);
  array[6] = (array[6] & 0x0f) | 0x40; // Version 4
  array[8] = (array[8] & 0x3f) | 0x80; // Variant bits
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

