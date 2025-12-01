/**
 * Client-side authentication utilities
 */

import { createClient } from '@/lib/supabase/client';
import { requestDeduplication } from '@/lib/request-deduplication';
import { authCache } from './cache';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  email_verified: boolean;
  is_admin: boolean;
}

/**
 * Get current user from API with caching and deduplication
 */
export async function getCurrentUser(forceRefresh = false): Promise<AuthUser | null> {
  // Check cache first (unless forced refresh)
  if (!forceRefresh) {
    const cached = authCache.get();
    if (cached !== undefined) {
      return cached;
    }
  }

  // Use request deduplication to prevent multiple simultaneous calls
  const requestKey = authCache.getRequestKey();
  
  try {
    const user = await requestDeduplication.deduplicate(
      requestKey,
      async () => {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          cache: 'no-store', // Always fetch fresh from server
        });

        if (!response.ok) {
          authCache.set(null);
          return null;
        }

        const data = await response.json();
        // New uniform API response format: { success: true, data: { user: ... } }
        if (data.success && data.data?.user) {
          const userData = data.data.user;
          authCache.set(userData);
          return userData;
        }
        
        authCache.set(null);
        return null;
      }
    );

    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    // On error, return cached value if available, otherwise null
    const cached = authCache.get();
    return cached !== undefined ? cached : null;
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    
    // Clear auth cache on logout (regardless of response)
    authCache.clear();
    
    if (!response.ok) {
      console.warn('Logout API returned non-OK status:', response.status);
    }
  } catch (error) {
    console.error('Error logging out:', error);
    // Clear cache even if API call fails
    authCache.clear();
  }
}

