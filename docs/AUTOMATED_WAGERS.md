# Automated Wager Generation System

## Overview
The wagr platform includes an automated system that creates wagers based on real-world events from various sources including cryptocurrency markets, financial markets, politics, and more.

## Architecture

### Components

1. **Wager Generators** (`lib/wager-generators/`)
   - `crypto.ts` - Generates wagers based on cryptocurrency prices
   - `finance.ts` - Generates wagers based on stock indices and forex rates
   - `politics.ts` - Generates wagers based on political events

2. **API Endpoints**
   - `/api/wagers/create-system` - Creates a single system-generated wager
   - `/api/agents/generate-wagers` - Vercel AI Agent that generates multiple wagers automatically

3. **Database Schema**
   - `wagers.category` - Category of the wager (crypto, finance, politics, etc.)
   - `wagers.tags` - Array of tags for filtering
   - `wagers.is_system_generated` - Boolean flag for system wagers
   - `wagers.source_data` - JSONB field for storing source information

## How It Works

### 1. Wager Generation

The system uses generator functions that create wager templates based on external data:

```typescript
// Example: Crypto wager generator
const cryptoWagers = generateCryptoWagers({
  BTC: 45000,
  ETH: 2500,
});
```

### 2. Automatic Creation

The Vercel AI Agent (`/api/agents/generate-wagers`) runs automatically (configured in `vercel.json`) and:
1. Fetches current market data (or uses mock data in development)
2. Generates wager templates for each category
3. Creates wagers via the `/api/wagers/create-system` endpoint
4. Prevents duplicates by checking for existing similar wagers

### 3. Duplicate Prevention

The system prevents duplicate wagers by:
- Checking for existing wagers with the same title and category
- Returning 409 (Conflict) if a similar wager already exists

## Setup

### 1. Run Database Migration

Execute `scripts/05-add-categories-and-preferences.sql` in Supabase SQL Editor.

### 2. Environment Variables

Add to your `.env.local`:
```
SYSTEM_WAGER_API_SECRET=your-secret-key-here
CRON_SECRET=your-cron-secret-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Configure Cron Jobs

The `vercel.json` file is already configured with:
- Settlement cron: Runs every minute
- Wager generation cron: Runs every 6 hours

### 4. Integrate Real Data Sources

To use real data instead of mock data:

1. **Crypto Prices**: Integrate with CoinGecko API or similar
2. **Stock Indices**: Integrate with Alpha Vantage or Yahoo Finance API
3. **Political Events**: Use news APIs or RSS feeds

Example integration:
```typescript
// In app/api/cron/generate-system-wagers/route.ts
const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
const prices = await response.json();
const cryptoWagers = generateCryptoWagers({
  BTC: prices.bitcoin.usd,
  ETH: prices.ethereum.usd,
});
```

## User Preferences

Users can set preferences for which categories they want to see:

1. Navigate to `/preferences`
2. Select preferred categories
3. Home page will automatically filter wagers based on preferences

If no preferences are set, users see all wagers.

## Categories

Available categories:
- `crypto` - Cryptocurrency
- `finance` - Finance & Stocks
- `politics` - Politics
- `sports` - Sports
- `entertainment` - Entertainment
- `technology` - Technology
- `religion` - Religion
- `weather` - Weather

## Adding New Generators

To add a new wager generator:

1. Create a new file in `lib/wager-generators/` (e.g., `sports.ts`)
2. Export a generator function that returns wager templates
3. Import and use it in `/api/cron/generate-system-wagers/route.ts`

Example:
```typescript
// lib/wager-generators/sports.ts
export function generateSportsWagers(upcomingGames: Game[]): WagerTemplate[] {
  return upcomingGames.map(game => ({
    title: `Will ${game.teamA} win against ${game.teamB}?`,
    side_a: game.teamA,
    side_b: game.teamB,
    amount: 500,
    deadline: game.date,
    category: "sports",
    tags: ["sports", game.sport],
  }));
}
```

