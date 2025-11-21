/**
 * Client-side authentication utilities
 */

import { createClient } from '@/lib/supabase/client';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  email_verified: boolean;
  is_admin: boolean;
}

/**
 * Get current user from API
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // New uniform API response format: { success: true, data: { user: ... } }
    if (data.success && data.data?.user) {
      return data.data.user;
    }
    return null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Error logging out:', error);
  }
}

