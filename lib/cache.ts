/**
 * Centralized caching utility for frontend
 * Provides sessionStorage, localStorage, and in-memory caching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  public memoryCache = new Map<string, CacheEntry<any>>(); // Made public for cache age checking
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get data from cache (checks memory, then sessionStorage, then localStorage)
   */
  get<T>(key: string): T | null {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
      return memoryEntry.data as T;
    }

    // Check sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const sessionData = sessionStorage.getItem(`cache_${key}`);
        if (sessionData) {
          const entry: CacheEntry<T> = JSON.parse(sessionData);
          if (Date.now() - entry.timestamp < entry.ttl) {
            // Also store in memory for faster access
            this.memoryCache.set(key, entry);
            return entry.data;
          } else {
            sessionStorage.removeItem(`cache_${key}`);
          }
        }
      } catch (e) {
        // SessionStorage might be unavailable
      }
    }

    return null;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`cache_${key}`, JSON.stringify(entry));
      } catch (e) {
        // SessionStorage might be full, clear old entries
        this.clearOldEntries();
        try {
          sessionStorage.setItem(`cache_${key}`, JSON.stringify(entry));
        } catch (e2) {
          // Still failed, just use memory cache
        }
      }
    }
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`cache_${key}`);
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('cache_')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Clear old cache entries to free up space
   */
  private clearOldEntries(): void {
    if (typeof window === 'undefined') return;

    try {
      const keys = Object.keys(sessionStorage);
      const now = Date.now();
      let cleared = 0;

      for (const key of keys) {
        if (key.startsWith('cache_')) {
          try {
            const data = sessionStorage.getItem(key);
            if (data) {
              const entry: CacheEntry<any> = JSON.parse(data);
              if (now - entry.timestamp >= entry.ttl) {
                sessionStorage.removeItem(key);
                cleared++;
              }
            }
          } catch (e) {
            // Invalid entry, remove it
            sessionStorage.removeItem(key);
            cleared++;
          }
        }
      }

      // If still not enough space, remove oldest entries
      if (cleared < 10) {
        const cacheEntries: Array<{ key: string; timestamp: number }> = [];
        for (const key of keys) {
          if (key.startsWith('cache_')) {
            try {
              const data = sessionStorage.getItem(key);
              if (data) {
                const entry: CacheEntry<any> = JSON.parse(data);
                cacheEntries.push({ key, timestamp: entry.timestamp });
              }
            } catch (e) {
              // Ignore
            }
          }
        }

        // Sort by timestamp and remove oldest 20%
        cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = Math.ceil(cacheEntries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
          sessionStorage.removeItem(cacheEntries[i].key);
        }
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// Singleton instance
export const cache = new CacheManager();

/**
 * Cache keys for different data types
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
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
  WAGERS: 30 * 1000, // 30 seconds
  WAGER: 60 * 1000, // 1 minute
  USER_PROFILE: 5 * 60 * 1000, // 5 minutes
  USER_PREFERENCES: 10 * 60 * 1000, // 10 minutes
  TRANSACTIONS: 2 * 60 * 1000, // 2 minutes
  NOTIFICATIONS: 30 * 1000, // 30 seconds
  LEADERBOARD: 5 * 60 * 1000, // 5 minutes
  ADMIN_DATA: 2 * 60 * 1000, // 2 minutes
} as const;

