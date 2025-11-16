/**
 * Custom hook for cached data fetching with stale-while-revalidate pattern
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cache, CACHE_TTL } from '@/lib/cache';

interface UseCachedQueryOptions<T> {
  queryKey: string;
  queryFn: () => Promise<T>;
  ttl?: number;
  enabled?: boolean;
  staleTime?: number; // Time before data is considered stale
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}

interface UseCachedQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

export function useCachedQuery<T>({
  queryKey,
  queryFn,
  ttl = CACHE_TTL.WAGERS,
  enabled = true,
  staleTime = 0,
  refetchOnMount = true,
  refetchOnWindowFocus = false,
}: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (force = false) => {
    if (fetchingRef.current) return;
    
    fetchingRef.current = true;
    
    try {
      // Check cache first (unless forced)
      if (!force) {
        const cached = cache.get<T>(queryKey);
        if (cached) {
          setData(cached);
          setIsLoading(false);
          
          // Check if data is stale
          const cacheEntry = cache.get<any>(queryKey);
          if (cacheEntry && Date.now() - cacheEntry.timestamp > staleTime) {
            // Data is stale, fetch in background but don't block
            queryFn()
              .then((newData) => {
                if (mountedRef.current) {
                  cache.set(queryKey, newData, ttl);
                  setData(newData);
                }
              })
              .catch((err) => {
                console.error('Background refetch failed:', err);
                // Don't update error state for background refetches
              });
          }
          
          fetchingRef.current = false;
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      const result = await queryFn();
      
      if (mountedRef.current) {
        cache.set(queryKey, result, ttl);
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        // Keep cached data if available
        const cached = cache.get<T>(queryKey);
        if (cached) {
          setData(cached);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [queryKey, queryFn, ttl, staleTime]);

  const invalidate = useCallback(() => {
    cache.remove(queryKey);
    setData(null);
  }, [queryKey]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled) {
      fetchData();
    }

    // Refetch on window focus if enabled
    if (refetchOnWindowFocus) {
      const handleFocus = () => {
        if (enabled) {
          fetchData();
        }
      };
      window.addEventListener('focus', handleFocus);
      return () => {
        window.removeEventListener('focus', handleFocus);
        mountedRef.current = false;
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, refetchOnMount, refetchOnWindowFocus, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchData(true),
    invalidate,
  };
}

