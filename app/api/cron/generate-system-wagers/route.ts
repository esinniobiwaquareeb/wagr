// API route to automatically generate system wagers
// This should be called periodically (e.g., every 6 hours) via external cron service
// Recommended: cron-job.org, EasyCron, or similar service
// Fetches data from various sources and creates wagers

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify this is called from a cron job
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = {
      crypto: 0,
      finance: 0,
      politics: 0,
      sports: 0,
      weather: 0,
      entertainment: 0,
      errors: [] as string[],
    };

    // Generate crypto wagers
    try {
      const { fetchCryptoPrices } = await import("@/lib/api/coingecko");
      const { generateCryptoWagers } = await import("@/lib/wager-generators/crypto");
      
      // Fetch real crypto prices
      const cryptoPrices = await fetchCryptoPrices(['bitcoin', 'ethereum', 'solana', 'cardano']);
      const cryptoWagers = generateCryptoWagers(cryptoPrices);

      for (const wager of cryptoWagers) {
        const response = await fetch(`${request.url.replace('/api/cron/generate-system-wagers', '/api/wagers/create-system')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET || 'dev-secret'}`,
          },
          body: JSON.stringify(wager),
        });

        if (response.ok) {
          results.crypto++;
        } else {
          const error = await response.json();
          if (response.status !== 409) { // 409 = already exists, not an error
            results.errors.push(`Crypto wager error: ${error.error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Crypto generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate finance wagers
    try {
      const { fetchStockQuotes, fetchForexRates } = await import("@/lib/api/alpha-vantage");
      const { generateFinanceWagers } = await import("@/lib/wager-generators/finance");
      
      // Fetch real stock and forex data
      const stockIndices = await fetchStockQuotes(['SPY', 'QQQ', 'DIA'], process.env.ALPHA_VANTAGE_API_KEY);
      const forexRates = await fetchForexRates(['EURUSD', 'GBPUSD'], process.env.ALPHA_VANTAGE_API_KEY);
      
      const financeWagers = generateFinanceWagers({
        stockIndices,
        forexRates,
      });

      for (const wager of financeWagers) {
        const response = await fetch(`${request.url.replace('/api/cron/generate-system-wagers', '/api/wagers/create-system')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET || 'dev-secret'}`,
          },
          body: JSON.stringify(wager),
        });

        if (response.ok) {
          results.finance++;
        } else {
          const error = await response.json();
          if (response.status !== 409) {
            results.errors.push(`Finance wager error: ${error.error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Finance generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate politics wagers
    try {
      const { fetchPoliticalNews } = await import("@/lib/api/news");
      const { generatePoliticsWagers } = await import("@/lib/wager-generators/politics");
      
      // Fetch real political news
      const newsArticles = await fetchPoliticalNews(process.env.NEWS_API_KEY);
      
      // Convert news articles to events
      const upcomingEvents = newsArticles.slice(0, 5).map((article, index) => ({
        name: article.title,
        date: new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(), // Spread over next 5 weeks
        description: article.description,
      }));
      
      const politicsWagers = generatePoliticsWagers(upcomingEvents);

      for (const wager of politicsWagers) {
        const response = await fetch(`${request.url.replace('/api/cron/generate-system-wagers', '/api/wagers/create-system')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET || 'dev-secret'}`,
          },
          body: JSON.stringify(wager),
        });

        if (response.ok) {
          results.politics++;
        } else {
          const error = await response.json();
          if (response.status !== 409) {
            results.errors.push(`Politics wager error: ${error.error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Politics generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate sports wagers
    try {
      const { generateSportsWagers, getMockSportsEvents } = await import("@/lib/wager-generators/sports");
      const sportsEvents = getMockSportsEvents();
      const sportsWagers = generateSportsWagers(sportsEvents);

      for (const wager of sportsWagers) {
        const response = await fetch(`${request.url.replace('/api/cron/generate-system-wagers', '/api/wagers/create-system')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET || 'dev-secret'}`,
          },
          body: JSON.stringify(wager),
        });

        if (response.ok) {
          results.sports++;
        } else {
          const error = await response.json();
          if (response.status !== 409) {
            results.errors.push(`Sports wager error: ${error.error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Sports generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate weather wagers
    try {
      const { generateWeatherWagers, getMockWeatherEvents } = await import("@/lib/wager-generators/weather");
      const weatherEvents = getMockWeatherEvents();
      const weatherWagers = generateWeatherWagers(weatherEvents);

      for (const wager of weatherWagers) {
        const response = await fetch(`${request.url.replace('/api/cron/generate-system-wagers', '/api/wagers/create-system')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET || 'dev-secret'}`,
          },
          body: JSON.stringify(wager),
        });

        if (response.ok) {
          results.weather++;
        } else {
          const error = await response.json();
          if (response.status !== 409) {
            results.errors.push(`Weather wager error: ${error.error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Weather generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate entertainment wagers
    try {
      const { generateEntertainmentWagers, getMockEntertainmentEvents } = await import("@/lib/wager-generators/entertainment");
      const entertainmentEvents = getMockEntertainmentEvents();
      const entertainmentWagers = generateEntertainmentWagers(entertainmentEvents);

      for (const wager of entertainmentWagers) {
        const response = await fetch(`${request.url.replace('/api/cron/generate-system-wagers', '/api/wagers/create-system')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET || 'dev-secret'}`,
          },
          body: JSON.stringify(wager),
        });

        if (response.ok) {
          results.entertainment++;
        } else {
          const error = await response.json();
          if (response.status !== 409) {
            results.errors.push(`Entertainment wager error: ${error.error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Entertainment generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return NextResponse.json({
      success: true,
      message: "System wager generation completed",
      results,
    });
  } catch (error) {
    console.error("Error in generate-system-wagers cron:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

