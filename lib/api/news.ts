// News API integration for political and current events
// Using NewsAPI.org (free tier available)

const NEWS_API_URL = 'https://newsapi.org/v2';

export interface NewsArticle {
  title: string;
  description: string;
  publishedAt: string;
  url: string;
  source: {
    name: string;
  };
}

export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
}

export async function fetchPoliticalNews(apiKey: string, country: string = 'us'): Promise<NewsArticle[]> {
  if (!apiKey) {
    throw new Error('News API key is required');
  }

  try {
    // Get current date and date from 3 days ago (very recent news only)
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fromDate = threeDaysAgo.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];

    // Fetch trending political news from the last 3 days, sorted by popularity
    const response = await fetch(
      `${NEWS_API_URL}/everything?q=politics OR election OR government OR policy&language=en&sortBy=popularity&from=${fromDate}&to=${toDate}&pageSize=20&apiKey=${apiKey}`,
      {
        next: { revalidate: 1800 } // Cache for 30 minutes
      }
    );

    if (!response.ok) {
      throw new Error(`News API error: ${response.statusText}`);
    }

    const data: NewsResponse = await response.json();
    
    // Filter to only get articles from the last 3 days and ensure they have valid dates
    const recentArticles = (data.articles || []).filter(article => {
      if (!article.publishedAt) return false;
      const publishedDate = new Date(article.publishedAt);
      const daysSincePublished = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSincePublished <= 3 && daysSincePublished >= 0;
    });

    // Return top trending articles (already sorted by popularity)
    return recentArticles.slice(0, 10);
  } catch (error) {
    console.error('Error fetching political news:', error);
    throw error;
  }
}

export async function fetchGeneralNews(apiKey: string, query: string = 'election', days: number = 3): Promise<NewsArticle[]> {
  if (!apiKey) {
    throw new Error('News API key is required');
  }

  try {
    // Get current date and date from specified days ago
    const now = new Date();
    const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fromDate = daysAgo.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];

    // Fetch trending general news, sorted by popularity
    const response = await fetch(
      `${NEWS_API_URL}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=popularity&from=${fromDate}&to=${toDate}&pageSize=20&apiKey=${apiKey}`,
      {
        next: { revalidate: 1800 } // Cache for 30 minutes
      }
    );

    if (!response.ok) {
      throw new Error(`News API error: ${response.statusText}`);
    }

    const data: NewsResponse = await response.json();
    
    // Filter to only get articles from the specified days
    const recentArticles = (data.articles || []).filter(article => {
      if (!article.publishedAt) return false;
      const publishedDate = new Date(article.publishedAt);
      const daysSincePublished = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSincePublished <= days && daysSincePublished >= 0;
    });

    // Return top trending articles (already sorted by popularity)
    return recentArticles.slice(0, 10);
  } catch (error) {
    console.error('Error fetching general news:', error);
    throw error;
  }
}

