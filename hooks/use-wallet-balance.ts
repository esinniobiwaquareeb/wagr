"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthUser } from "@/lib/auth/client";

export interface UseWalletBalanceResult {
  walletBalance: number | null;
  refreshBalance: () => Promise<void>;
}

/**
 * Hook for fetching and tracking wallet balance
 * Listens to balance-updated and wager-updated events
 */
export function useWalletBalance(user: AuthUser | null): UseWalletBalanceResult {
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const fetchingRef = useRef(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWalletBalance = useCallback(async () => {
    if (!user) {
      setWalletBalance(null);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { walletApi } = await import('@/lib/api-client');
      const response = await walletApi.getBalance();
      setWalletBalance(response.balance);
    } catch (error) {
      // Silent fail
    } finally {
      fetchingRef.current = false;
    }
  }, [user]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { walletApi } = await import('@/lib/api-client');
        const response = await walletApi.getBalance();
        setWalletBalance(response.balance);
      } catch (error) {
        // Silent fail
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (user) {
      fetchWalletBalance();

      const handleBalanceUpdate = () => {
        debouncedFetch();
      };

      window.addEventListener('balance-updated', handleBalanceUpdate);
      window.addEventListener('wager-updated', handleBalanceUpdate);

      return () => {
        window.removeEventListener('balance-updated', handleBalanceUpdate);
        window.removeEventListener('wager-updated', handleBalanceUpdate);
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    } else {
      setWalletBalance(null);
    }
  }, [user, fetchWalletBalance, debouncedFetch]);

  return {
    walletBalance,
    refreshBalance: fetchWalletBalance,
  };
}

