// AI-powered news analyzer for generating intelligent wagers
// Uses AI to analyze trending news and create understandable wagers

export interface NewsAnalysis {
  event: string;
  outcome: string;
  deadline: string;
  description: string;
  confidence: number;
  isTrending: boolean;
}

export interface WagerSuggestion {
  title: string;
  description: string;
  sideA: string;
  sideB: string;
  deadline: string;
  category: string;
  tags: string[];
  reasoning: string; // Why this wager makes sense
}

/**
 * Analyze news articles using AI to extract wagerable events
 */
export async function analyzeNewsForWagers(
  articles: Array<{ title: string; description: string; publishedAt: string }>,
  apiKey?: string
): Promise<WagerSuggestion[]> {
  if (!apiKey) {
    // Fallback to simple extraction if no AI key
    return extractSimpleWagers(articles);
  }

  try {
    // Use OpenAI or similar AI service
    const aiService = await getAIService(apiKey);
    return await aiService.analyzeNews(articles);
  } catch (error) {
    console.error('AI analysis error, falling back to simple extraction:', error);
    return extractSimpleWagers(articles);
  }
}

/**
 * Analyze news outcome for settlement using AI
 */
export async function analyzeNewsForSettlement(
  wagerTitle: string,
  wagerDescription: string,
  deadline: string,
  apiKey?: string
): Promise<{ winningSide: 'a' | 'b' | null; reasoning: string; confidence: number }> {
  if (!apiKey) {
    return { winningSide: null, reasoning: 'AI not configured', confidence: 0 };
  }

  try {
    const aiService = await getAIService(apiKey);
    return await aiService.analyzeSettlement(wagerTitle, wagerDescription, deadline);
  } catch (error) {
    console.error('AI settlement analysis error:', error);
    return { winningSide: null, reasoning: 'Analysis failed', confidence: 0 };
  }
}

/**
 * Get trending news articles (most popular/relevant)
 */
export async function getTrendingNews(
  articles: Array<{ title: string; description: string; publishedAt: string; url?: string }>,
  limit: number = 5
): Promise<Array<{ title: string; description: string; publishedAt: string }>> {
  // Sort by recency and relevance (you can enhance this with engagement metrics)
  const sorted = articles
    .filter(a => a.title && a.description)
    .sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return dateB - dateA; // Most recent first
    });

  return sorted.slice(0, limit);
}

/**
 * Simple extraction fallback (no AI)
 */
function extractSimpleWagers(
  articles: Array<{ title: string; description: string; publishedAt: string }>
): WagerSuggestion[] {
  const categories = ['crypto', 'finance', 'politics', 'sports', 'entertainment', 'technology', 'religion', 'weather'];
  const sideOptions = [
    { sideA: 'Yes', sideB: 'No' },
    { sideA: 'Win', sideB: 'Lose' },
    { sideA: 'True', sideB: 'False' },
    { sideA: 'Higher', sideB: 'Lower' },
  ];
  
  return articles.slice(0, 5).map((article, index) => {
    const deadline = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000);
    const category = categories[index % categories.length];
    const sides = sideOptions[index % sideOptions.length];
    
    return {
      title: article.title.length > 80 ? article.title.substring(0, 77) + '...' : article.title,
      description: article.description || article.title,
      sideA: sides.sideA,
      sideB: sides.sideB,
      deadline: deadline.toISOString(),
      category: category,
      tags: [category, 'news', 'trending'],
      reasoning: 'Based on recent news article',
    };
  });
}

/**
 * Get AI service (OpenAI, Anthropic, etc.)
 */
async function getAIService(apiKey: string) {
  // Try to use OpenAI if available
  if (process.env.OPENAI_API_KEY || apiKey.includes('sk-')) {
    return await import('../ai-services/openai');
  }
  
  // Try Anthropic if available
  if (process.env.ANTHROPIC_API_KEY || apiKey.includes('sk-ant-')) {
    return await import('../ai-services/anthropic');
  }
  
  throw new Error('No AI service configured');
}

