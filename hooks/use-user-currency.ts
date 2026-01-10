"use client";

import { useState, useEffect } from "react";
import { preferencesApi } from "@/lib/api-client";
import { logger } from "@/lib/logger";

export interface UserCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

const DEFAULT_CURRENCY: UserCurrency = {
  id: "",
  code: "NGN",
  name: "Nigerian Naira",
  symbol: "₦",
};

/**
 * Hook to get current user's currency preference
 */
export function useUserCurrency() {
  const [currency, setCurrency] = useState<UserCurrency>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrency = async () => {
      try {
        const response = await preferencesApi.get();
        const prefs = response.preferences;

        if (prefs?.currency) {
          setCurrency({
            id: prefs.currency.id,
            code: prefs.currency.code,
            name: prefs.currency.name,
            symbol: prefs.currency.symbol,
          });
        } else {
          // Use default if no preference set
          setCurrency(DEFAULT_CURRENCY);
        }
      } catch (error) {
        logger.error("Error fetching user currency", error);
        // Fallback to default on error
        setCurrency(DEFAULT_CURRENCY);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrency();

    // Listen for currency updates
    const handleCurrencyUpdate = () => {
      fetchCurrency();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('currency-updated', handleCurrencyUpdate);
      return () => {
        window.removeEventListener('currency-updated', handleCurrencyUpdate);
      };
    }
  }, []);

  return { currency, loading };
}
