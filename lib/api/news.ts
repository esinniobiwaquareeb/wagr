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
    const response = await fetch(
      `${NEWS_API_URL}/top-headlines?country=${country}&category=politics&pageSize=10&apiKey=${apiKey}`,
      {
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    );

    if (!response.ok) {
      throw new Error(`News API error: ${response.statusText}`);
    }

    const data: NewsResponse = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error('Error fetching political news:', error);
    throw error;
  }
}

export async function fetchGeneralNews(apiKey: string, query: string = 'election'): Promise<NewsArticle[]> {
  if (!apiKey) {
    throw new Error('News API key is required');
  }

  try {
    const response = await fetch(
      `${NEWS_API_URL}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`,
      {
        next: { revalidate: 3600 }
      }
    );

    if (!response.ok) {
      throw new Error(`News API error: ${response.statusText}`);
    }

    const data: NewsResponse = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
}

