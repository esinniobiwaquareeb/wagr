/**
 * Server-side authentication utilities
 */

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserId } from './session';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  email_verified: boolean;
  is_admin: boolean;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, username, email_verified, is_admin, deleted_at, is_suspended')
    .eq('id', userId)
    .maybeSingle();

  // Handle database errors - if it's a connection error or other DB issue, return null
  if (error) {
    // PGRST116 = no rows returned (user doesn't exist or is deleted)
    if (error.code === 'PGRST116') {
      return null;
    }
    // Log other database errors but don't throw - just return null
    const { logError } = await import('@/lib/error-handler');
    logError(new Error(`Database error in getCurrentUser: ${error.message}`), {
      error,
      code: error.code,
      userId,
    });
    return null;
  }

  // If no profile found, return null
  if (!profile) {
    return null;
  }

  // Check if account is deleted (check in code, not in query)
  if (profile.deleted_at) {
    return null;
  }

  // If account is suspended, delete all sessions and return null
  if (profile.is_suspended) {
    const { deleteAllUserSessions } = await import('./session');
    await deleteAllUserSessions(userId);
    const { clearSessionCookie } = await import('./session');
    await clearSessionCookie();
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    email_verified: profile.email_verified || false,
    is_admin: profile.is_admin || false,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require email verification - throws if email is not verified
 */
export async function requireEmailVerified(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.email_verified) {
    throw new Error('Email verification required');
  }
  return user;
}

/**
 * Check if user is admin
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.is_admin) {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}

