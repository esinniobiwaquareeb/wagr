/**
 * Global auth cache to prevent multiple API calls
 */

import { requestDeduplication, generateRequestKey } from '@/lib/request-deduplication';
import type { AuthUser } from './client';

interface AuthCacheEntry {
  user: AuthUser | null;
  timestamp: number;
}

class AuthCache {
  private cache: AuthCacheEntry | null = null;
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private readonly REQUEST_KEY = 'auth/me';

  /**
   * Get cached user if still valid
   */
  get(): AuthUser | null | undefined {
    if (!this.cache) return undefined;
    
    const age = Date.now() - this.cache.timestamp;
    if (age < this.CACHE_TTL) {
      return this.cache.user;
    }
    
    // Cache expired
    this.cache = null;
    return undefined;
  }

  /**
   * Set cached user
   */
  set(user: AuthUser | null): void {
    this.cache = {
      user,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache = null;
  }

  /**
   * Get request key for deduplication
   */
  getRequestKey(): string {
    return this.REQUEST_KEY;
  }
}

export const authCache = new AuthCache();

