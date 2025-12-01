"use client";

import { useEffect } from 'react';
import { initializeErrorTracking } from '@/lib/monitoring';

/**
 * Client-side monitoring initialization component
 * This ensures error tracking is initialized on the client side
 */
export function MonitoringInit() {
  useEffect(() => {
    initializeErrorTracking();
  }, []);

  return null;
}

