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

/**
 * Hook to fetch and access platform settings on the client side
 * Only fetches public settings or requires admin authentication
 */
export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch public settings (non-admin endpoint)
      try {
        const response = await apiGet<{ settings: Record<string, any> }>('/settings/public');
        
        if (response && response.settings) {
          setSettings(response.settings);
        }
      } catch (adminError) {
        // If public endpoint fails, try admin endpoint (for admin users)
        try {
          const adminResponse = await apiGet<{ settings: Setting[]; grouped: any }>('/admin/settings');
          
          if (adminResponse && adminResponse.settings) {
            const settingsMap: SettingsMap = {};
            adminResponse.settings.forEach((setting: Setting) => {
              if (setting.is_public) {
                settingsMap[setting.key] = setting.value;
              }
            });
            setSettings(settingsMap);
          }
        } catch (err) {
          throw adminError; // Throw original error if both fail
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
      // Set defaults on error
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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

  return {
    settings,
    loading,
    error,
    getSetting,
    getWagerLimits,
    getQuizLimits,
    getPaymentLimits,
    refetch: fetchSettings,
  };
}

/**
 * Get a specific setting value
 */
export function useSetting<T = any>(key: string, defaultValue?: T): T {
  const { getSetting } = useSettings();
  return getSetting(key, defaultValue) as T;
}

