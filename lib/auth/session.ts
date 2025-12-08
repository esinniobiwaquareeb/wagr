/**
 * Session management utilities
 * 
 * @deprecated This file is deprecated. Session management is now handled by JWT tokens via NestJS backend.
 * These functions are kept for backward compatibility but most are no longer used.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'wagr_session';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const REGULAR_SESSION_DURATION = 24 * 60 * 60 * 1000; // 1 day in milliseconds

/**
 * Generate a secure session token using Web Crypto API (Edge Runtime compatible)
 */
export async function generateSessionToken(): Promise<string> {
  // Use Web Crypto API which works in both Node.js and Edge Runtime
  const array = new Uint8Array(32);
  
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Web Crypto API is not available');
  }
  
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session for a user
 * 
 * @deprecated Sessions are now managed by JWT tokens from NestJS backend
 */
export async function createSession(
  userId: string, 
  ipAddress?: string, 
  userAgent?: string, 
  rememberMe: boolean = false
): Promise<string> {
  // Sessions are now handled by JWT tokens from NestJS
  // This function is kept for backward compatibility
  const token = await generateSessionToken();
  return token;
}

/**
 * Get user ID from session token
 * 
 * @deprecated Session tokens are now JWT tokens validated by NestJS backend
 */
export async function getUserIdFromSession(token: string): Promise<string | null> {
  if (!token) {
    return null;
  }

  // JWT tokens are validated by NestJS backend via verifyJWTToken
  // This function is kept for backward compatibility but should not be used
  // For middleware, use verifyJWTToken from nestjs-server instead
  return null;
}

/**
 * Delete a session
 * 
 * @deprecated Sessions are now JWT tokens managed by NestJS backend
 */
export async function deleteSession(token: string): Promise<void> {
  // Sessions are now JWT tokens - logout is handled by NestJS backend
  // This function is kept for backward compatibility
}

/**
 * Delete all sessions for a user
 * 
 * @deprecated Sessions are now JWT tokens managed by NestJS backend
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  // Sessions are now JWT tokens - logout is handled by NestJS backend
  // This function is kept for backward compatibility
}

/**
 * Get session from cookie
 */
export async function getSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return sessionToken || null;
}

/**
 * Set session cookie
 */
export async function setSessionCookie(
  token: string, 
  response?: NextResponse, 
  rememberMe: boolean = false
): Promise<NextResponse | void> {
  const duration = rememberMe ? REMEMBER_ME_DURATION : REGULAR_SESSION_DURATION;
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: Math.floor(duration / 1000), // Convert to seconds
    path: '/',
  };

  if (response) {
    // Set cookie on existing response object
    response.cookies.set(SESSION_COOKIE_NAME, token, cookieOptions);
    return response;
  } else {
    // Set cookie via cookies() API (for use in routes that don't have a response yet)
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions);
  }
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get current authenticated user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const token = await getSessionFromCookie();
  if (!token) {
    return null;
  }

  return getUserIdFromSession(token);
}

