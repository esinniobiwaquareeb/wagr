/**
 * Auth cache - DISABLED
 * All caching has been removed. This file is kept for backwards compatibility
 * but all methods are no-ops.
 */

import { requestDeduplication, generateRequestKey } from '@/lib/request-deduplication';
import type { AuthUser } from './client';

interface AuthCacheEntry {
  user: AuthUser | null;
  timestamp: number;
}

class AuthCache {
  /**
   * Get cached user - DISABLED (always returns undefined)
   */
  get(): AuthUser | null | undefined {
    return undefined;
  }

  /**
   * Set cached user - DISABLED (no-op)
   */
  set(user: AuthUser | null): void {
    // No-op - caching disabled
  }

  /**
   * Clear cache - DISABLED (no-op)
   */
  clear(): void {
    // No-op - caching disabled
  }

  /**
   * Get request key for deduplication
   */
  getRequestKey(): string {
    return 'auth/me';
  }
}

export const authCache = new AuthCache();
