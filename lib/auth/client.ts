/**
 * Client-side authentication utilities
 */

import { requestDeduplication } from '@/lib/request-deduplication';
import { logger } from '@/lib/logger';

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

        // 401/403 are expected when user is not authenticated - don't treat as errors
        if (!response.ok) {
          // Only log unexpected errors (not 401/403)
          if (response.status !== 401 && response.status !== 403) {
            logger.warn('Unexpected status when fetching user', { status: response.status });
          }
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
    // Only log unexpected errors, not network errors or expected auth failures
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('fetch') && !errorMessage.includes('network')) {
      logger.error('Error fetching current user', error);
    }
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
      logger.warn('Logout API returned non-OK status', { status: response.status });
    }
  } catch (error) {
    logger.error('Error logging out', error);
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
 * Logout admin
 */
export async function adminLogout(): Promise<void> {
  try {
    const response = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    
    if (!response.ok) {
      logger.warn('Admin logout API returned non-OK status', { status: response.status });
    }
  } catch (error) {
    logger.error('Error logging out admin', error);
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
 * Uses Next.js API route /api/admin/me (not direct backend call)
 */
export const getCurrentAdmin = async (forceRefresh = false): Promise<AdminAuthUser | null> => {
  // Use request deduplication to prevent multiple simultaneous calls
  const requestKey = 'admin/me';
  
  try {
    const admin = await requestDeduplication.deduplicate(
      requestKey,
      async () => {
        // Use Next.js API route, NOT direct backend call
        const response = await fetch('/api/admin/me', {
          credentials: 'include',
          cache: 'no-store', // Always fetch fresh from server
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        
        // Safely check response structure
        if (!data || !data.success || !data.data) {
          return null;
        }
        
        // API response format: { success: true, data: { admin: ... } }
        if (data.data.admin) {
          const adminData = data.data.admin;
          return adminData;
        }
        
        return null;
      }
    );

    return admin as AdminAuthUser | null;
  } catch (error) {
    logger.error('Error fetching current admin', error);
    return null;
  }
};