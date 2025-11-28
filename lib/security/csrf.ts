/**
 * CSRF Protection Utilities
 * Implements CSRF token generation and validation
 */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const CSRF_TOKEN_NAME = 'csrf_token';
const CSRF_TOKEN_HEADER = 'X-CSRF-Token';

/**
 * Generate a secure CSRF token
 */
export async function generateCSRFToken(): Promise<string> {
  const array = new Uint8Array(32);
  
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Web Crypto API is not available');
  }
  
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get CSRF token from cookie
 */
export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value || null;
}

/**
 * Set CSRF token in cookie
 */
export async function setCSRFToken(response?: Response): Promise<string> {
  const token = await generateCSRFToken();
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
  
  return token;
}

/**
 * Validate CSRF token from request
 */
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  const method = request.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  
  // Get token from cookie
  const cookieToken = await getCSRFToken();
  
  // Both must exist and match
  if (!headerToken || !cookieToken) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return constantTimeEqual(headerToken, cookieToken);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Middleware to require CSRF token for state-changing operations
 */
export async function requireCSRF(request: NextRequest): Promise<void> {
  const isValid = await validateCSRFToken(request);
  
  if (!isValid) {
    throw new Error('Invalid CSRF token');
  }
}

