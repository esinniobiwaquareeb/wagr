/**
 * Platform Settings with Redis Caching
 * Enhanced version of settings.ts with Redis caching for better performance
 */

import { getSetting as getSettingDb, getSettings as getSettingsDb } from './settings';
import { getCached, setCached, getOrFetch, CacheKeys, CACHE_TTL, invalidateSettingsCache } from './redis/cache';

/**
 * Get a setting value by key with Redis caching
 * Falls back to database if Redis is unavailable
 */
export async function getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
  const cacheKey = CacheKeys.platformSetting(key);

  return getOrFetch(
    cacheKey,
    async () => {
      return await getSettingDb<T>(key, defaultValue);
    },
    CACHE_TTL.PLATFORM_SETTINGS
  );
}

/**
 * Get multiple settings by keys with Redis caching
 */
export async function getSettings(keys: string[]): Promise<Record<string, any>> {
  // Try to get all from cache first
  const cachePromises = keys.map((key) =>
    getCached<any>(CacheKeys.platformSetting(key))
  );
  const cachedResults = await Promise.all(cachePromises);

  // Check which keys are missing from cache
  const missingKeys: string[] = [];
  const result: Record<string, any> = {};

  cachedResults.forEach((cached, index) => {
    const key = keys[index];
    if (cached !== null) {
      result[key] = cached;
    } else {
      missingKeys.push(key);
    }
  });

  // Fetch missing keys from database
  if (missingKeys.length > 0) {
    const dbResults = await getSettingsDb(missingKeys);
    Object.assign(result, dbResults);

    // Cache the fetched results
    await Promise.all(
      Object.entries(dbResults).map(([key, value]) =>
        setCached(CacheKeys.platformSetting(key), value, CACHE_TTL.PLATFORM_SETTINGS)
      )
    );
  }

  return result;
}

/**
 * Get all public settings with Redis caching
 */
export async function getAllPublicSettings(): Promise<Record<string, any>> {
  const cacheKey = CacheKeys.platformSettingsAll();

  return getOrFetch(
    cacheKey,
    async () => {
      const { createServiceRoleClient } = await import('@/lib/supabase/server');
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .eq('is_public', true);

      const settings: Record<string, any> = {};
      data?.forEach((setting) => {
        settings[setting.key] = setting.value;
      });

      return settings;
    },
    CACHE_TTL.PLATFORM_SETTINGS_ALL
  );
}

/**
 * Invalidate settings cache (call this when settings are updated)
 */
export async function invalidateSettings(): Promise<void> {
  await invalidateSettingsCache();
}

// Re-export other functions from settings.ts
export {
  getSettingsByCategory,
  isFeatureEnabled,
  getWagerPlatformFee,
  getQuizPlatformFee,
  getPaymentLimits,
  getWagerLimits,
  getQuizLimits,
  getSecuritySettings,
  getEmailSettings,
  getBillsSettings,
  getKYCLimits,
} from './settings';

