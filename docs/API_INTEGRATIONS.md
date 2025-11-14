# API Integrations Guide

## Overview
wagr integrates with multiple external APIs to automatically generate wagers based on real-world data.

## Required API Keys

Add these environment variables to your `.env.local`:

```env
# CoinGecko (Free tier available)
# No API key required for basic usage
COINGECKO_API_KEY=optional

# Alpha Vantage (Free tier: 5 API calls/minute, 500/day)
ALPHA_VANTAGE_API_KEY=your-api-key-here

# News API (Free tier: 100 requests/day)
NEWS_API_KEY=your-api-key-here
```

## API Integrations

### 1. CoinGecko (Cryptocurrency)

**Purpose**: Fetch real-time cryptocurrency prices

**Implementation**: `lib/api/coingecko.ts`

**Usage**:
```typescript
import { fetchCryptoPrices } from '@/lib/api/coingecko';

const prices = await fetchCryptoPrices(['bitcoin', 'ethereum', 'solana']);
// Returns: { BTC: 45000, ETH: 2500, SOL: 100 }
```

**Features**:
- No API key required for basic usage
- Free tier: Unlimited requests
- Cached for 60 seconds
- Fallback to mock data if API fails

**Get API Key** (Optional):
1. Visit https://www.coingecko.com/en/api
2. Sign up for free account
3. Get API key for higher rate limits

### 2. Alpha Vantage (Stock Market & Forex)

**Purpose**: Fetch stock quotes and forex rates

**Implementation**: `lib/api/alpha-vantage.ts`

**Usage**:
```typescript
import { fetchStockQuotes, fetchForexRates } from '@/lib/api/alpha-vantage';

const stocks = await fetchStockQuotes(['SPY', 'QQQ'], apiKey);
const forex = await fetchForexRates(['EURUSD', 'GBPUSD'], apiKey);
```

**Features**:
- Free tier: 5 API calls/minute, 500/day
- Cached for 5 minutes
- Rate limit handling with delays
- Fallback to mock data if API fails

**Get API Key**:
1. Visit https://www.alphavantage.co/support/#api-key
2. Fill out the form
3. Get your free API key instantly

### 3. News API (Political Events)

**Purpose**: Fetch political news and current events

**Implementation**: `lib/api/news.ts`

**Usage**:
```typescript
import { fetchPoliticalNews } from '@/lib/api/news';

const articles = await fetchPoliticalNews(apiKey, 'us');
```

**Features**:
- Free tier: 100 requests/day
- Cached for 1 hour
- Country-specific news
- Fallback to mock data if API fails

**Get API Key**:
1. Visit https://newsapi.org/
2. Sign up for free account
3. Get API key from dashboard

## Fallback Behavior

All API integrations include fallback mechanisms:
- If API key is missing: Uses mock data
- If API fails: Uses mock data
- If rate limited: Uses cached data or mock data

This ensures the system continues working even if external APIs are unavailable.

## Rate Limiting

The system implements rate limiting strategies:
- **CoinGecko**: No limits (free tier)
- **Alpha Vantage**: 200ms delay between requests
- **News API**: Cached for 1 hour

## Adding New Integrations

To add a new API integration:

1. Create a new file in `lib/api/` (e.g., `sports-api.ts`)
2. Implement fetch functions with error handling
3. Add fallback mock data
4. Import and use in `app/api/cron/generate-system-wagers/route.ts`

Example:
```typescript
// lib/api/sports-api.ts
export async function fetchUpcomingGames(apiKey?: string) {
  if (!apiKey) return getMockGames();
  
  try {
    const response = await fetch(`https://api.example.com/games`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return await response.json();
  } catch (error) {
    return getMockGames();
  }
}
```

