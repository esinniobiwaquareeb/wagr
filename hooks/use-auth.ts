import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout as clientLogout, type AuthUser } from '@/lib/auth/client';

export interface UseAuthOptions {
  redirectTo?: string;
  redirectIfAuthenticated?: boolean;
  requireAuth?: boolean;
}

export interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Reusable hook for authentication checks
 * Handles user authentication state and optional redirects
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthResult {
  const {
    redirectTo,
    redirectIfAuthenticated = false,
    requireAuth = false,
  } = options;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const fetchingRef = useRef(false);

  const fetchUser = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent fetches within this hook instance
    // Note: getCurrentUser() itself handles global deduplication
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // getCurrentUser now uses caching and deduplication internally
      const currentUser = await getCurrentUser(forceRefresh);
      setUser(currentUser);
      setLoading(false);

      // Handle redirects
      if (redirectIfAuthenticated && currentUser && redirectTo) {
        router.push(redirectTo);
      } else if (requireAuth && !currentUser && redirectTo) {
        router.push(redirectTo);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
      setLoading(false);
      
      if (requireAuth && redirectTo) {
        router.push(redirectTo);
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [router, redirectTo, redirectIfAuthenticated, requireAuth]);

  const handleLogout = useCallback(async () => {
    await clientLogout();
    setUser(null);
    router.refresh();
    
    // Trigger auth state change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-changed'));
    }
  }, [router]);

  const refresh = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  // Store fetchUser in ref to avoid dependency issues
  const fetchUserRef = useRef(fetchUser);
  useEffect(() => {
    fetchUserRef.current = fetchUser;
  }, [fetchUser]);

  useEffect(() => {
    fetchUserRef.current();

    // Listen for auth state changes
    const handleAuthStateChanged = () => {
      // Force refresh to bypass cache after logout
      fetchUserRef.current(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-state-changed', handleAuthStateChanged);
    }

    // Poll for auth changes (fallback) - increased to 5 minutes to reduce calls
    const interval = setInterval(() => {
      fetchUserRef.current();
    }, 300000); // Check every 5 minutes instead of 1 minute

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      }
      clearInterval(interval);
    };
  }, []); // Empty deps - only set up once

  return { user, loading, logout: handleLogout, refresh };
}
