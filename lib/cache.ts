/**
 * Frontend cache utility - DISABLED
 * All caching has been removed. This file is kept for backwards compatibility
 * but all methods are no-ops.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  /**
   * Get data from cache - DISABLED (always returns null)
   */
  get<T>(key: string): T | null {
    return null;
  }

  /**
   * Set data in cache - DISABLED (no-op)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // No-op - caching disabled
  }

  /**
   * Remove specific cache entry - DISABLED (no-op)
   */
  remove(key: string): void {
    // No-op - caching disabled
  }

  /**
   * Clear all cache entries - DISABLED (no-op)
   */
  clear(): void {
    // No-op - caching disabled
  }

  /**
   * Check if cache entry exists - DISABLED (always returns false)
   */
  has(key: string): boolean {
    return false;
  }

  // Public property for backwards compatibility (but unused)
  public memoryCache = new Map<string, CacheEntry<any>>();
}

// Singleton instance
export const cache = new CacheManager();

/**
 * Cache keys for different data types (kept for backwards compatibility)
 */
export const CACHE_KEYS = {
  WAGERS: 'wagers',
  WAGER: (id: string) => `wager_${id}`,
  USER_PROFILE: (id: string) => `profile_${id}`,
  USER_PREFERENCES: (id: string) => `preferences_${id}`,
  TRANSACTIONS: (id: string) => `transactions_${id}`,
  NOTIFICATIONS: (id: string) => `notifications_${id}`,
  LEADERBOARD: 'leaderboard',
  ADMIN_STATS: 'admin_stats',
  ADMIN_USERS: 'admin_users',
  ADMIN_WAGERS: 'admin_wagers',
  ADMIN_TRANSACTIONS: 'admin_transactions',
} as const;

/**
 * Cache TTL constants (kept for backwards compatibility but unused)
 */
export const CACHE_TTL = {
  WAGERS: 30 * 1000,
  WAGER: 60 * 1000,
  USER_PROFILE: 5 * 60 * 1000,
  USER_PREFERENCES: 10 * 60 * 1000,
  TRANSACTIONS: 2 * 60 * 1000,
  NOTIFICATIONS: 30 * 1000,
  LEADERBOARD: 5 * 60 * 1000,
  ADMIN_DATA: 2 * 60 * 1000,
} as const;
