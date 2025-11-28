/**
 * Redis Cache Utility
 * High-level caching functions with automatic fallback to database
 */

import { getRedisClient } from './client';

// Cache TTLs (in seconds)
// Note: Wager and quiz TTLs are defined in their respective modules (lib/redis/wagers.ts)
export const CACHE_TTL = {
  PLATFORM_SETTINGS: 3600, // 1 hour - settings rarely change
  PLATFORM_SETTINGS_ALL: 1800, // 30 minutes - all settings
  USER_PROFILE: 300, // 5 minutes - user profiles
  BANK_LIST: 86400, // 24 hours - bank list rarely changes
  TRANSACTION_AGGREGATE: 300, // 5 minutes - transaction stats
  KYC_SUMMARY: 600, // 10 minutes - KYC data
  DATA_PLANS: 3600, // 1 hour - data plans rarely change
} as const;

/**
 * Get cached value from Redis
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const value = await client.get(key);
    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Redis: Error getting cache for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value in Redis
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = CACHE_TTL.PLATFORM_SETTINGS
): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Redis: Error setting cache for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete cached value from Redis
 */
export async function deleteCached(key: string | string[]): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return false;

    await client.del(keys);
    return true;
  } catch (error) {
    console.error(`Redis: Error deleting cache for key(s):`, error);
    return false;
  }
}

/**
 * Invalidate cache by pattern (e.g., "user:*" or "settings:*")
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client) return 0;

    const keys: string[] = [];
    for await (const key of client.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      keys.push(key);
    }

    if (keys.length === 0) return 0;

    await client.del(keys);
    return keys.length;
  } catch (error) {
    console.error(`Redis: Error invalidating pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Cache key generators
 * Note: Wager and quiz caching keys are handled in their respective modules
 * (lib/redis/wagers.ts for wagers)
 */
export const CacheKeys = {
  platformSetting: (key: string) => `settings:${key}`,
  platformSettingsAll: () => 'settings:all',
  userProfile: (userId: string) => `user:profile:${userId}`,
  userBalance: (userId: string) => `user:balance:${userId}`,
  bankList: () => 'banks:list',
  transactionAggregate: (userId: string, period: string) => `tx:agg:${userId}:${period}`,
  kycSummary: (userId: string) => `kyc:${userId}`,
  dataPlans: (provider: string) => `data:plans:${provider}`,
} as const;

/**
 * Get or fetch with cache (cache-aside pattern)
 * If cache miss, fetches from database and caches the result
 */
export async function getOrFetch<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.PLATFORM_SETTINGS
): Promise<T> {
  // Try cache first
  const cached = await getCached<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch from database
  const data = await fetchFn();

  // Cache the result (fire and forget)
  setCached(cacheKey, data, ttl).catch((err) => {
    console.error(`Redis: Failed to cache ${cacheKey}:`, err);
  });

  return data;
}

/**
 * Invalidate user-related caches
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    deleteCached(CacheKeys.userProfile(userId)),
    deleteCached(CacheKeys.userBalance(userId)),
    deleteCached(CacheKeys.kycSummary(userId)),
    invalidatePattern(`tx:agg:${userId}:*`),
  ]);
}

/**
 * Invalidate all settings cache
 */
export async function invalidateSettingsCache(): Promise<void> {
  await Promise.all([
    deleteCached(CacheKeys.platformSettingsAll()),
    invalidatePattern('settings:*'),
  ]);
}

