# Caching Strategy

This document outlines the comprehensive caching strategy implemented in the wagr application to optimize performance and user experience.

## Overview

The application implements a multi-layered caching strategy:

1. **Frontend Memory Cache** - Fast in-memory cache for frequently accessed data
2. **SessionStorage Cache** - Persistent cache for the current session
3. **Service Worker Cache** - Offline-first caching for static assets and API responses
4. **Next.js Static Optimization** - Built-in Next.js caching for static assets
5. **HTTP Cache Headers** - Browser-level caching directives

## Components

### 1. Centralized Cache Utility (`lib/cache.ts`)

A unified caching system that provides:
- **Memory cache** for instant access
- **SessionStorage** for persistence across page reloads
- **Automatic cleanup** of stale entries
- **TTL (Time To Live)** management

**Usage:**
```typescript
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

// Get cached data
const data = cache.get<DataType>(CACHE_KEYS.WAGERS);

// Set cached data
cache.set(CACHE_KEYS.WAGERS, data, CACHE_TTL.WAGERS);

// Remove cached data
cache.remove(CACHE_KEYS.WAGERS);

// Clear all cache
cache.clear();
```

### 2. Cached Query Hook (`lib/hooks/use-cached-query.ts`)

A React hook that implements the **stale-while-revalidate** pattern:
- Returns cached data immediately if available
- Fetches fresh data in the background if cache is stale
- Automatically updates UI when fresh data arrives
- Handles loading and error states

**Usage:**
```typescript
const { data, isLoading, error, refetch, invalidate } = useCachedQuery({
  queryKey: CACHE_KEYS.WAGERS,
  queryFn: async () => {
    // Fetch data from API
    return await fetchWagers();
  },
  ttl: CACHE_TTL.WAGERS,
  staleTime: 10 * 1000, // Consider stale after 10 seconds
});
```

### 3. Service Worker (`public/sw.js`)

Enhanced service worker with:
- **Multiple cache stores** for different content types:
  - Static assets (7 days)
  - Images (30 days)
  - API responses (5 minutes)
  - HTML pages (1 hour)
- **Stale-while-revalidate** strategy for better UX
- **Offline fallback** support
- **Automatic cache cleanup**

### 4. HTTP Cache Headers (`next.config.mjs`)

Configured cache headers for:
- **Static assets** (`/_next/static/*`): 1 year (immutable)
- **Icons** (`/icons/*`): 1 year (immutable)
- **Service worker** (`/sw.js`): No cache (always fresh)
- **Manifest** (`/manifest.json`): 1 hour

## Cache TTLs

Different data types have different cache durations based on update frequency:

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Wagers List | 30 seconds | Frequently updated |
| Wager Detail | 1 minute | Moderate updates |
| User Profile | 5 minutes | Rarely changes |
| User Preferences | 10 minutes | Rarely changes |
| Transactions | 2 minutes | Moderate updates |
| Notifications | 30 seconds | Real-time updates |
| Leaderboard | 5 minutes | Moderate updates |
| Admin Data | 2 minutes | Moderate updates |

## Cache Invalidation

Caches are invalidated in the following scenarios:

1. **Automatic expiration** - Based on TTL
2. **Manual invalidation** - When data is updated (e.g., after creating a wager)
3. **User actions** - When user performs write operations
4. **Real-time updates** - Supabase realtime subscriptions update cache

## Best Practices

1. **Always check cache first** before making API calls
2. **Use stale-while-revalidate** for better perceived performance
3. **Invalidate cache** after write operations
4. **Set appropriate TTLs** based on data volatility
5. **Monitor cache size** to prevent storage issues

## Performance Benefits

- **Reduced API calls** - Up to 80% reduction in database queries
- **Faster page loads** - Instant display of cached data
- **Better offline experience** - Service worker provides offline support
- **Lower server load** - Fewer requests to backend
- **Improved UX** - No loading spinners for cached data

## Future Enhancements

- [ ] IndexedDB for larger data storage
- [ ] Cache compression for storage efficiency
- [ ] Cache analytics and monitoring
- [ ] Predictive prefetching
- [ ] Cache warming strategies

