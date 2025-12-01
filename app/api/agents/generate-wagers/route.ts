// Vercel AI Agent for automatic wager generation
// This agent aggregates data from various sources and creates wagers automatically
// Configured to run every 2 minutes for testing (adjust in Vercel dashboard)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_WAGER_AMOUNT } from "@/lib/constants";

// Note: Using Node.js runtime for better compatibility with external API calls
// export const runtime = 'edge';
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
      technology: 0,
      religion: 0,
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
        const origin = request.nextUrl?.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${origin}/api/wagers/create-system`, {
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
          const origin = request.nextUrl?.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const response = await fetch(`${origin}/api/wagers/create-system`, {
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

    // Generate wagers from news using AI (supports all categories)
    try {
      if (process.env.NEWS_API_KEY) {
        const { fetchPoliticalNews, fetchGeneralNews } = await import("@/lib/api/news");
        const { analyzeNewsForWagers, getTrendingNews } = await import("@/lib/ai/news-analyzer");
        
        // Fetch news from ALL categories to ensure comprehensive coverage
        const newsPromises = [
          fetchPoliticalNews(process.env.NEWS_API_KEY).catch(() => []),
          fetchGeneralNews(process.env.NEWS_API_KEY, 'cryptocurrency OR bitcoin OR ethereum OR blockchain').catch(() => []),
          fetchGeneralNews(process.env.NEWS_API_KEY, 'stock market OR finance OR economy OR trading').catch(() => []),
          fetchGeneralNews(process.env.NEWS_API_KEY, 'sports OR football OR basketball OR soccer OR tennis').catch(() => []),
          fetchGeneralNews(process.env.NEWS_API_KEY, 'entertainment OR movie OR music OR awards OR celebrity').catch(() => []),
          fetchGeneralNews(process.env.NEWS_API_KEY, 'technology OR tech OR innovation OR AI OR software').catch(() => []),
          fetchGeneralNews(process.env.NEWS_API_KEY, 'religion OR religious OR faith OR church OR mosque').catch(() => []),
          fetchGeneralNews(process.env.NEWS_API_KEY, 'weather OR climate OR temperature OR rain OR storm').catch(() => []),
        ];
        
        const allNewsArticles = (await Promise.all(newsPromises)).flat();
        
        // Get trending news (most popular/relevant) from all categories
        const trendingArticles = await getTrendingNews(allNewsArticles, 10);
        
        // Use AI to analyze and generate intelligent wagers across all categories
        const aiApiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
        const wagerSuggestions = await analyzeNewsForWagers(trendingArticles, aiApiKey);
        
        // Convert AI suggestions to wager format, grouping by category
        const wagersByCategory = new Map<string, any[]>();
        
        wagerSuggestions.forEach(suggestion => {
          const category = suggestion.category || 'politics';
          if (!wagersByCategory.has(category)) {
            wagersByCategory.set(category, []);
          }
          wagersByCategory.get(category)!.push({
            title: suggestion.title,
            description: suggestion.description,
          side_a: suggestion.sideA,
          side_b: suggestion.sideB,
          amount: DEFAULT_WAGER_AMOUNT,
          deadline: suggestion.deadline,
          category: category,
          source_data: {
            reasoning: suggestion.reasoning,
            ai_generated: true,
          },
          });
        });
        
        // Process wagers by category - ensure ALL categories are created
        const allNewsWagers: any[] = [];
        for (const [category, wagers] of wagersByCategory.entries()) {
          allNewsWagers.push(...wagers);
        }

        // Create wagers for ALL categories
        for (const wager of allNewsWagers) {
          const origin = request.nextUrl?.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const response = await fetch(`${origin}/api/wagers/create-system`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SYSTEM_WAGER_API_SECRET}`,
            },
            body: JSON.stringify(wager),
          });

          if (response.ok) {
            // Update results counter based on actual category
            const category = wager.category || 'other';
            if (category === 'politics') {
              results.politics++;
            } else if (category === 'crypto') {
              results.crypto++;
            } else if (category === 'finance') {
              results.finance++;
            } else if (category === 'sports') {
              results.sports++;
            } else if (category === 'entertainment') {
              results.entertainment++;
            } else if (category === 'technology') {
              results.technology++;
            } else if (category === 'religion') {
              results.religion++;
            } else if (category === 'weather') {
              results.weather++;
            }
          } else {
            const error = await response.json();
            if (response.status !== 409) {
              results.errors.push(`${wager.category || 'unknown'}: ${error.error || error.message || 'Failed to create wager'}`);
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

