/**
 * Client-side authentication utilities
 */

import { requestDeduplication } from '@/lib/request-deduplication';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  email_verified: boolean;
  /**
   * is_admin is only present for admin tokens (type: 'admin')
   * User tokens should NOT have this field since admins are completely separate
   * Check with: user?.is_admin === true
   */
  is_admin?: boolean;
}

export interface AdminAuthUser {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
}
/**
 * Get current user from API with deduplication (no caching)
 */
export async function getCurrentUser(forceRefresh = false): Promise<AuthUser | null> {
  // Use request deduplication to prevent multiple simultaneous calls
  const requestKey = 'auth/me';
  
  try {
    const user = await requestDeduplication.deduplicate(
      requestKey,
      async () => {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          cache: 'no-store', // Always fetch fresh from server
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        // New uniform API response format: { success: true, data: { user: ... } }
        if (data.success && data.data?.user) {
          const userData = data.data.user;
          return userData;
        }
        
        return null;
      }
    );

    return user;
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
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.warn('Logout API returned non-OK status:', response.status);
    }
  } catch (error) {
    console.error('Error logging out:', error);
  } finally {
    // Always remove token from client, even if API call failed
    // Import here to avoid circular dependency
    const { removeAuthToken } = await import('@/lib/nestjs-client');
    removeAuthToken();
    
    // Dispatch auth state change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-changed'));
    }
  }
}

/**
 * Get current admin from API with deduplication (no caching)
 */
export const getCurrentAdmin = async (forceRefresh = false): Promise<AdminAuthUser | null> => {
  // Use request deduplication to prevent multiple simultaneous calls
  const requestKey = 'admin/me';
  
  try {
    const admin = await requestDeduplication.deduplicate(
      requestKey,
      async () => {
        const response = await fetch('/api/admin/me', {
          credentials: 'include',
          cache: 'no-store', // Always fetch fresh from server
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        // API response format: { success: true, data: { admin: ... } }
        if (data.success && data.data?.admin) {
          const adminData = data.data.admin;
          return adminData;
        }
        
        return null;
      }
    );

    return admin as AdminAuthUser | null;
  } catch (error) {
    console.error('Error fetching current admin:', error);
    return null;
  }
};