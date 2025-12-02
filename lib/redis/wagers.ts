/**
 * Wager-specific Redis Caching
 * Optimized caching for wager data to reduce database load
 */

import { getCached, setCached, getOrFetch, CacheKeys, CACHE_TTL, deleteCached, invalidatePattern } from './cache';

// Wager-specific cache TTLs
export const WAGER_CACHE_TTL = {
  LIST: 30, // 30 seconds - wager lists change frequently
  DETAIL: 60, // 1 minute - individual wager details
  ENTRY_COUNTS: 30, // 30 seconds - entry counts update when people join
  USER_WAGERS: 120, // 2 minutes - user's wagers list
} as const;

/**
 * Generate cache key for wager list with filters
 */
function getWagerListKey(params: {
  page?: number;
  limit?: number;
  status?: string | null;
  category?: string | null;
  search?: string | null;
  currency?: string | null;
  userId?: string | null;
}): string {
  const { page = 1, limit = 20, status, category, search, currency, userId } = params;
  const parts = [
    'wagers:list',
    userId ? `u:${userId}` : 'u:anonymous',
    `p:${page}`,
    `l:${limit}`,
    status ? `s:${status}` : '',
    category ? `c:${category}` : '',
    search ? `q:${search.toLowerCase().trim()}` : '',
    currency ? `cur:${currency}` : '',
  ].filter(Boolean);
  return parts.join(':');
}

/**
 * Generate cache key for wager detail
 */
function getWagerDetailKey(wagerId: string): string {
  return `wager:detail:${wagerId}`;
}

/**
 * Generate cache key for wager entry counts
 */
function getWagerEntryCountsKey(wagerId: string): string {
  return `wager:entries:${wagerId}`;
}

/**
 * Generate cache key for user's wagers
 */
function getUserWagersKey(userId: string, filters?: { status?: string }): string {
  const parts = ['wagers:user', userId];
  if (filters?.status) {
    parts.push(`s:${filters.status}`);
  }
  return parts.join(':');
}

/**
 * Cache wager list with filters
 */
export async function cacheWagerList(
  params: {
    page?: number;
    limit?: number;
    status?: string | null;
    category?: string | null;
    search?: string | null;
    currency?: string | null;
    userId?: string | null;
  },
  data: any
): Promise<void> {
  const key = getWagerListKey(params);
  await setCached(key, data, WAGER_CACHE_TTL.LIST);
}

/**
 * Get cached wager list
 */
export async function getCachedWagerList(params: {
  page?: number;
  limit?: number;
  status?: string | null;
  category?: string | null;
  search?: string | null;
  currency?: string | null;
  userId?: string | null;
}): Promise<any | null> {
  const key = getWagerListKey(params);
  return getCached(key);
}

/**
 * Cache wager detail
 */
export async function cacheWagerDetail(wagerId: string, data: any): Promise<void> {
  const key = getWagerDetailKey(wagerId);
  await setCached(key, data, WAGER_CACHE_TTL.DETAIL);
}

/**
 * Get cached wager detail
 */
export async function getCachedWagerDetail(wagerId: string): Promise<any | null> {
  const key = getWagerDetailKey(wagerId);
  return getCached(key);
}

/**
 * Cache wager entry counts
 */
export async function cacheWagerEntryCounts(wagerId: string, counts: { sideA: number; sideB: number; total: number }): Promise<void> {
  const key = getWagerEntryCountsKey(wagerId);
  await setCached(key, counts, WAGER_CACHE_TTL.ENTRY_COUNTS);
}

/**
 * Get cached wager entry counts
 */
export async function getCachedWagerEntryCounts(wagerId: string): Promise<{ sideA: number; sideB: number; total: number } | null> {
  const key = getWagerEntryCountsKey(wagerId);
  return getCached(key);
}

/**
 * Cache user's wagers
 */
export async function cacheUserWagers(userId: string, data: any, filters?: { status?: string }): Promise<void> {
  const key = getUserWagersKey(userId, filters);
  await setCached(key, data, WAGER_CACHE_TTL.USER_WAGERS);
}

/**
 * Get cached user's wagers
 */
export async function getCachedUserWagers(userId: string, filters?: { status?: string }): Promise<any | null> {
  const key = getUserWagersKey(userId, filters);
  return getCached(key);
}

/**
 * Invalidate all wager-related caches
 * Call this when a wager is created, updated, or deleted
 */
export async function invalidateWagerCaches(wagerId?: string): Promise<void> {
  const promises: Promise<any>[] = [
    // Invalidate all wager lists (they might include this wager)
    invalidatePattern('wagers:list:*'),
    // Invalidate all user wager lists
    invalidatePattern('wagers:user:*'),
  ];

  if (wagerId) {
    // Invalidate specific wager detail
    promises.push(deleteCached(getWagerDetailKey(wagerId)));
    // Invalidate entry counts for this wager
    promises.push(deleteCached(getWagerEntryCountsKey(wagerId)));
  } else {
    // Invalidate all wager details
    promises.push(invalidatePattern('wager:detail:*'));
    // Invalidate all entry counts
    promises.push(invalidatePattern('wager:entries:*'));
  }

  await Promise.all(promises);
}

/**
 * Invalidate wager list caches
 * Call this when wagers are created/updated in bulk
 */
export async function invalidateWagerLists(): Promise<void> {
  await invalidatePattern('wagers:list:*');
}

/**
 * Invalidate user's wager caches
 * Call this when a user creates/updates a wager
 */
export async function invalidateUserWagers(userId: string): Promise<void> {
  await invalidatePattern(`wagers:user:${userId}*`);
}

/**
 * Get or fetch wager list with caching
 */
export async function getOrFetchWagerList<T>(
  params: {
    page?: number;
    limit?: number;
    status?: string | null;
    category?: string | null;
    search?: string | null;
    currency?: string | null;
    userId?: string | null;
  },
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = getWagerListKey(params);
  return getOrFetch(cacheKey, fetchFn, WAGER_CACHE_TTL.LIST);
}

/**
 * Get or fetch wager detail with caching
 */
export async function getOrFetchWagerDetail<T>(
  wagerId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = getWagerDetailKey(wagerId);
  return getOrFetch(cacheKey, fetchFn, WAGER_CACHE_TTL.DETAIL);
}

/**
 * Get or fetch wager entry counts with caching
 */
export async function getOrFetchWagerEntryCounts<T>(
  wagerId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cacheKey = getWagerEntryCountsKey(wagerId);
  return getOrFetch(cacheKey, fetchFn, WAGER_CACHE_TTL.ENTRY_COUNTS);
}

