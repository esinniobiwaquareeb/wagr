// Alpha Vantage API integration for stock market data

const ALPHA_VANTAGE_API_URL = 'https://www.alphavantage.co/query';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
}

export async function fetchStockQuotes(symbols: string[] = ['SPY', 'QQQ', 'DIA'], apiKey?: string): Promise<Record<string, number>> {
  // If no API key, return mock data
  if (!apiKey) {
    console.warn('Alpha Vantage API key not provided, using mock data');
    return {
      'SPY': 4500,
      'QQQ': 14000,
      'DIA': 35000,
    };
  }

  const prices: Record<string, number> = {};

  try {
    // Alpha Vantage has rate limits, so we'll fetch one at a time
    for (const symbol of symbols.slice(0, 5)) { // Limit to 5 to avoid rate limits
      try {
        const response = await fetch(
          `${ALPHA_VANTAGE_API_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`,
          {
            next: { revalidate: 300 } // Cache for 5 minutes
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch ${symbol}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        
        if (data['Global Quote'] && data['Global Quote']['05. price']) {
          prices[symbol] = parseFloat(data['Global Quote']['05. price']);
        }
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (error) {
    console.error('Error fetching stock quotes:', error);
  }

  // Return mock data if no prices fetched
  if (Object.keys(prices).length === 0) {
    return {
      'SPY': 4500,
      'QQQ': 14000,
      'DIA': 35000,
    };
  }

  return prices;
}

export async function fetchForexRates(pairs: string[] = ['EURUSD', 'GBPUSD', 'JPYUSD'], apiKey?: string): Promise<Record<string, number>> {
  if (!apiKey) {
    console.warn('Alpha Vantage API key not provided, using mock data');
    return {
      'EUR/USD': 0.92,
      'GBP/USD': 1.25,
      'JPY/USD': 0.0067,
    };
  }

  const rates: Record<string, number> = {};

  try {
    for (const pair of pairs.slice(0, 3)) {
      try {
        const from = pair.substring(0, 3);
        const to = pair.substring(3, 6);
        
        const response = await fetch(
          `${ALPHA_VANTAGE_API_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${apiKey}`,
          {
            next: { revalidate: 300 }
          }
        );

        if (!response.ok) continue;

        const data = await response.json();
        
        if (data['Realtime Currency Exchange Rate'] && data['Realtime Currency Exchange Rate']['5. Exchange Rate']) {
          const rate = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate']);
          rates[`${from}/${to}`] = rate;
        }
      } catch (error) {
        console.error(`Error fetching ${pair}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (error) {
    console.error('Error fetching forex rates:', error);
  }

  if (Object.keys(rates).length === 0) {
    return {
      'EUR/USD': 0.92,
      'GBP/USD': 1.25,
      'JPY/USD': 0.0067,
    };
  }

  return rates;
}

