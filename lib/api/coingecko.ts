// CoinGecko API integration for cryptocurrency prices

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

export interface CoinGeckoPrice {
  usd: number;
  [key: string]: number;
}

export interface CoinGeckoPrices {
  [coinId: string]: CoinGeckoPrice;
}

export async function fetchCryptoPrices(coinIds: string[] = ['bitcoin', 'ethereum', 'solana', 'cardano']): Promise<Record<string, number>> {
  try {
    const ids = coinIds.join(',');
    const response = await fetch(
      `${COINGECKO_API_URL}/simple/price?ids=${ids}&vs_currencies=usd`,
      {
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data: CoinGeckoPrices = await response.json();
    
    // Convert to our format: { BTC: price, ETH: price, ... }
    const prices: Record<string, number> = {};
    
    // Map coin IDs to symbols
    const coinMap: Record<string, string> = {
      bitcoin: 'BTC',
      ethereum: 'ETH',
      solana: 'SOL',
      cardano: 'ADA',
      binancecoin: 'BNB',
      ripple: 'XRP',
      dogecoin: 'DOGE',
      polkadot: 'DOT',
    };

    Object.entries(data).forEach(([coinId, priceData]) => {
      const symbol = coinMap[coinId] || coinId.toUpperCase();
      prices[symbol] = priceData.usd;
    });

    return prices;
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    // Return fallback prices if API fails
    return {
      BTC: 45000,
      ETH: 2500,
      SOL: 100,
    };
  }
}

