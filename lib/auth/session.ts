/**
 * Session management utilities
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'wagr_session';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

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
 */
export async function createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
  const supabase = await createClient();
  const token = await generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const { error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    });

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return token;
}

/**
 * Get user ID from session token
 */
export async function getUserIdFromSession(token: string): Promise<string | null> {
  if (!token) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if session is expired
  if (new Date(data.expires_at) < new Date()) {
    // Delete expired session
    await supabase.from('sessions').delete().eq('token', token);
    return null;
  }

  // Update last_used_at
  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token);

  return data.user_id;
}

/**
 * Delete a session
 */
export async function deleteSession(token: string): Promise<void> {
  if (!token) {
    return;
  }

  const supabase = await createClient();
  await supabase.from('sessions').delete().eq('token', token);
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('sessions').delete().eq('user_id', userId);
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
export async function setSessionCookie(token: string, response?: NextResponse): Promise<NextResponse | void> {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: Math.floor(SESSION_DURATION / 1000), // Convert to seconds
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

