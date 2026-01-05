"use client";

import { useState, useEffect } from "react";
import { isFeatureEnabled } from "@/lib/settings";

/**
 * Hook to check if gamification is enabled
 * Returns true by default (for backward compatibility) if the check fails
 */
export function useGamificationEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(true); // Default to true for backward compatibility
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkEnabled = async () => {
      try {
        const isEnabled = await isFeatureEnabled("features.gamification.enabled");
        setEnabled(isEnabled);
      } catch (error) {
        // If check fails, default to enabled for backward compatibility
        console.warn("Failed to check gamification status, defaulting to enabled", error);
        setEnabled(true);
      } finally {
        setLoading(false);
      }
    };

    checkEnabled();
  }, []);

  return enabled;
}

