import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export interface UseAuthOptions {
  redirectTo?: string;
  redirectIfAuthenticated?: boolean;
  requireAuth?: boolean;
}

export interface UseAuthResult {
  user: any;
  loading: boolean;
  supabase: ReturnType<typeof createClient>;
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

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('Auth error:', error);
          setUser(null);
          setLoading(false);
          
          if (requireAuth && redirectTo) {
            router.push(redirectTo);
          }
          return;
        }

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
    };

    checkUser();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router, redirectTo, redirectIfAuthenticated, requireAuth]);

  return { user, loading, supabase };
}

