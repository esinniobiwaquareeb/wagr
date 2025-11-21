import { useState, useEffect, useMemo, useCallback } from 'react';
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

  const fetchUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
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

  useEffect(() => {
    fetchUser();

    // Listen for auth state changes
    const handleAuthStateChanged = () => {
      fetchUser();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-state-changed', handleAuthStateChanged);
    }

    // Poll for auth changes (fallback)
    const interval = setInterval(() => {
      fetchUser();
    }, 60000); // Check every minute

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      }
      clearInterval(interval);
    };
  }, [fetchUser]);

  return { user, loading, logout: handleLogout, refresh };
}
