// Vercel AI Agent for automatic wager generation
// This agent aggregates data from various sources and creates wagers automatically
// Configured to run every 2 minutes for testing (adjust in Vercel dashboard)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify this is called from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const results = {
      crypto: 0,
      finance: 0,
      politics: 0,
      sports: 0,
      weather: 0,
      entertainment: 0,
      errors: [] as string[],
      timestamp: new Date().toISOString(),
    };

    // Generate crypto wagers
    try {
      const { fetchCryptoPrices } = await import("@/lib/api/coingecko");
      const { generateCryptoWagers } = await import("@/lib/wager-generators/crypto");
      
      const cryptoPrices = await fetchCryptoPrices(['bitcoin', 'ethereum', 'solana', 'cardano']);
      const cryptoWagers = generateCryptoWagers(cryptoPrices);

      for (const wager of cryptoWagers) {
        const response = await fetch(`${request.nextUrl.origin}/api/wagers/create-system`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET}`,
          },
          body: JSON.stringify(wager),
        });

        if (response.ok) {
          results.crypto++;
        } else {
          const error = await response.json();
          if (response.status !== 409) {
            results.errors.push(`Crypto: ${error.error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Crypto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate finance wagers
    try {
      if (process.env.ALPHA_VANTAGE_API_KEY) {
        const { fetchStockQuotes, fetchForexRates } = await import("@/lib/api/alpha-vantage");
        const { generateFinanceWagers } = await import("@/lib/wager-generators/finance");
        
        const stockIndices = await fetchStockQuotes(['SPY', 'QQQ', 'DIA'], process.env.ALPHA_VANTAGE_API_KEY);
        const forexRates = await fetchForexRates(['EURUSD', 'GBPUSD'], process.env.ALPHA_VANTAGE_API_KEY);
        
        const financeWagers = generateFinanceWagers({
          stockIndices,
          forexRates,
        });

        for (const wager of financeWagers) {
          const response = await fetch(`${request.nextUrl.origin}/api/wagers/create-system`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET}`,
            },
            body: JSON.stringify(wager),
          });

          if (response.ok) {
            results.finance++;
          } else {
            const error = await response.json();
            if (response.status !== 409) {
              results.errors.push(`Finance: ${error.error}`);
            }
          }
        }
      }
    } catch (error) {
      results.errors.push(`Finance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Generate politics wagers
    try {
      if (process.env.NEWS_API_KEY) {
        const { fetchPoliticalNews } = await import("@/lib/api/news");
        const { generatePoliticsWagers } = await import("@/lib/wager-generators/politics");
        
        const newsArticles = await fetchPoliticalNews(process.env.NEWS_API_KEY);
        const upcomingEvents = newsArticles.slice(0, 5).map((article, index) => ({
          name: article.title,
          date: new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
          description: article.description,
        }));
        
        const politicsWagers = generatePoliticsWagers(upcomingEvents);

        for (const wager of politicsWagers) {
          const response = await fetch(`${request.nextUrl.origin}/api/wagers/create-system`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET}`,
            },
            body: JSON.stringify(wager),
          });

          if (response.ok) {
            results.politics++;
          } else {
            const error = await response.json();
            if (response.status !== 409) {
              results.errors.push(`Politics: ${error.error}`);
            }
          }
        }
      }
    } catch (error) {
      results.errors.push(`Politics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return NextResponse.json({
      success: true,
      message: "Wager generation agent completed",
      results,
    });
  } catch (error) {
    console.error("Error in generate-wagers agent:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

