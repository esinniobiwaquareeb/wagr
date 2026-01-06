"use client";

import { useSettings } from "@/hooks/use-settings";

/**
 * Hook to check if gamification is enabled
 * Uses the public settings endpoint to check the feature flag
 * Returns true by default (for backward compatibility) if the check fails
 */
export function useGamificationEnabled(): boolean {
  const { getSetting, loading } = useSettings();
  
  // Get the setting value, defaulting to true for backward compatibility
  const enabled = getSetting("features.gamification.enabled", true) === true;
  
  // While loading, default to true to avoid showing "disabled" message prematurely
  if (loading) {
    return true;
  }
  
  return enabled;
}

