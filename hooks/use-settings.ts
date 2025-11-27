"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-client";

interface Setting {
  key: string;
  value: any;
  category: string;
  label: string;
  description?: string;
  data_type: 'boolean' | 'number' | 'string' | 'json' | 'array';
  is_public: boolean;
  requires_restart: boolean;
}

interface SettingsMap {
  [key: string]: any;
}

let settingsCache: SettingsMap | null = null;
let settingsPromise: Promise<SettingsMap> | null = null;
let settingsError: Error | null = null;

async function fetchSettingsFromApi(): Promise<SettingsMap> {
  try {
    const response = await apiGet<{ settings: Record<string, any> }>('/settings/public');
    if (response?.settings) {
      return response.settings;
    }
    return {};
  } catch (publicError) {
    try {
      const adminResponse = await apiGet<{ settings: Setting[] }>('/admin/settings');
      if (adminResponse?.settings) {
        const settingsMap: SettingsMap = {};
        adminResponse.settings.forEach((setting) => {
          if (setting.is_public) {
            settingsMap[setting.key] = setting.value;
          }
        });
        return settingsMap;
      }
      return {};
    } catch {
      if (publicError instanceof Error) {
        throw publicError;
      }
      throw new Error('Failed to fetch settings');
    }
  }
}

async function loadSettings(force = false): Promise<SettingsMap> {
  if (!force) {
    if (settingsCache) {
      return settingsCache;
    }
    if (settingsPromise) {
      return settingsPromise;
    }
  }

  const fetchPromise = fetchSettingsFromApi()
    .then((data) => {
      settingsCache = data;
      settingsError = null;
      return data;
    })
    .catch((err) => {
      const normalizedError = err instanceof Error ? err : new Error('Failed to fetch settings');
      settingsError = normalizedError;
      if (!force) {
        settingsCache = null;
      }
      throw normalizedError;
    });

  if (!force) {
    settingsPromise = fetchPromise.finally(() => {
      settingsPromise = null;
    });
    return settingsPromise;
  }

  await fetchPromise;
  return settingsCache || {};
}

/**
 * Hook to fetch and access platform settings on the client side
 * Only fetches public settings or requires admin authentication
 */
export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap>(() => settingsCache || {});
  const [loading, setLoading] = useState(!settingsCache);
  const [error, setError] = useState<Error | null>(settingsError);

  useEffect(() => {
    let isMounted = true;

    if (settingsCache) {
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    loadSettings()
      .then((data) => {
        if (!isMounted) return;
        setSettings(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
        setSettings({});
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getSetting = useCallback((key: string, defaultValue?: any) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }, [settings]);

  // Helper functions for common settings
  const getWagerLimits = useCallback(() => {
    return {
      minAmount: getSetting('wagers.min_amount', 100) as number,
      maxAmount: getSetting('wagers.max_amount', 1000000) as number,
      minDeadline: getSetting('wagers.min_deadline_days', 1) as number,
      maxDeadline: getSetting('wagers.max_deadline_days', 30) as number,
      defaultDeadline: getSetting('wagers.default_deadline_days', 7) as number,
      maxTitleLength: getSetting('wagers.max_title_length', 200) as number,
      maxDescriptionLength: getSetting('wagers.max_description_length', 1000) as number,
      maxSideLength: getSetting('wagers.max_side_length', 100) as number,
    };
  }, [getSetting]);

  const getQuizLimits = useCallback(() => {
    return {
      minEntryFeePerQuestion: getSetting('quizzes.min_entry_fee_per_question', 10) as number,
      maxEntryFeePerQuestion: getSetting('quizzes.max_entry_fee_per_question', 1000) as number,
      minParticipants: getSetting('quizzes.min_participants', 2) as number,
      maxParticipants: getSetting('quizzes.max_participants', 100) as number,
      minQuestions: getSetting('quizzes.min_questions', 1) as number,
      maxQuestions: getSetting('quizzes.max_questions', 50) as number,
    };
  }, [getSetting]);

  const getPaymentLimits = useCallback(() => {
    return {
      minDeposit: getSetting('payments.min_deposit', 100) as number,
      maxDeposit: getSetting('payments.max_deposit', 10000000) as number,
      minWithdrawal: getSetting('payments.min_withdrawal', 100) as number,
      maxWithdrawal: getSetting('payments.max_withdrawal', 1000000) as number,
    };
  }, [getSetting]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadSettings(true);
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    settings,
    loading,
    error,
    getSetting,
    getWagerLimits,
    getQuizLimits,
    getPaymentLimits,
    refetch,
  };
}

/**
 * Get a specific setting value
 */
export function useSetting<T = any>(key: string, defaultValue?: T): T {
  const { getSetting } = useSettings();
  return getSetting(key, defaultValue) as T;
}

