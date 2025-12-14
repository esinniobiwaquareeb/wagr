import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout as clientLogout, type AuthUser } from '@/lib/auth/client';
import { logger } from '@/lib/logger';

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
      // Only log unexpected errors, not 401/403 which are expected after logout
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Unauthorized') && !errorMessage.includes('Forbidden')) {
        logger.error('Error checking auth', error);
      }
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
  const userRef = useRef(user);
  useEffect(() => {
    fetchUserRef.current = fetchUser;
    userRef.current = user;
  }, [fetchUser, user]);

  useEffect(() => {
    fetchUserRef.current();

    // Listen for auth state changes
    const handleAuthStateChanged = () => {
      // Only fetch if we have a user or haven't checked yet
      // This prevents unnecessary API calls after logout
      if (userRef.current !== null) {
        fetchUserRef.current(true);
      } else {
        // If user is already null, just ensure loading is false
        setLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-state-changed', handleAuthStateChanged);
    }

    // Poll for auth changes (fallback) - increased to 5 minutes to reduce calls
    // Only poll if user exists (don't poll after logout)
    const interval = setInterval(() => {
      // Only fetch if we have a user (don't poll after logout)
      // This prevents continuous errors after logout
      if (userRef.current !== null) {
        fetchUserRef.current();
      }
    }, 300000); // Check every 5 minutes instead of 1 minute

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      }
      clearInterval(interval);
    };
  }, []); // Empty deps - use refs to access current values

  return { user, loading, logout: handleLogout, refresh };
}
