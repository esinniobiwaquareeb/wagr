// Anthropic Claude integration for news analysis and wager generation

interface NewsArticle {
  title: string;
  description: string;
  publishedAt: string;
}

interface WagerSuggestion {
  title: string;
  description: string;
  sideA: string;
  sideB: string;
  deadline: string;
  category: string;
  reasoning: string;
}

export async function analyzeNews(articles: NewsArticle[]): Promise<WagerSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const trendingArticles = articles.slice(0, 5);

  const prompt = `You are a wager platform analyst. Analyze these recent news articles and create clear, understandable wagers.

News Articles:
${trendingArticles.map((a, i) => `${i + 1}. ${a.title}\n   ${a.description || ''}`).join('\n\n')}

AVAILABLE CATEGORIES:
- crypto: Cryptocurrency and blockchain
- finance: Finance, stocks, and markets
- politics: Politics, elections, government
- sports: Sports events and competitions
- entertainment: Movies, TV, music, awards
- technology: Tech news, product launches, innovations
- religion: Religious events and topics
- weather: Weather predictions and events

AVAILABLE SIDE OPTIONS (choose the most appropriate):
- Yes / No: For binary questions
- Win / Lose: For competitions and outcomes
- Over / Under: For numerical predictions (e.g., "Over 100" / "Under 100")
- True / False: For factual statements
- Higher / Lower: For price/value comparisons
- Custom: For specific outcomes (e.g., team names, specific values)

Create wagers with:
- Clear questions (max 80 chars)
- Descriptions explaining the wager
- Two sides: Choose the most appropriate side format based on category
- Deadlines 1-7 days from now
- Most appropriate category from the list above
- Reasoning for why it's a good wager

Category-specific guidelines:
- crypto: Use "Higher/Lower" or "Over/Under" for prices, "Yes/No" for events
- finance: Use "Higher/Lower" or "Over/Under" for market predictions
- politics: Use "Yes/No" or "Win/Lose" for elections, "True/False" for statements
- sports: Use team names or "Win/Lose" for matches, "Over/Under" for scores
- entertainment: Use "Yes/No" for predictions, specific names for awards
- technology: Use "Yes/No" for launches, "True/False" for features
- religion: Use "Yes/No" or "True/False" for events
- weather: Use "Yes/No" for events, "Over/Under" for temperatures/rainfall

Focus on trending topics with clear, verifiable outcomes.

Return JSON array:
[{"title": "...", "description": "...", "sideA": "Appropriate side", "sideB": "Appropriate side", "deadline": "ISO date", "category": "one of the categories above", "reasoning": "..."}]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Fast and cost-effective
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    
    if (!content) {
      throw new Error('No response from Anthropic');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const wagers = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return wagers.map((w: any) => ({
      title: w.title || 'Unknown wager',
      description: w.description || '',
      sideA: w.sideA || 'Yes',
      sideB: w.sideB || 'No',
      deadline: w.deadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      category: w.category || 'politics',
      reasoning: w.reasoning || '',
    })).slice(0, 5);
  } catch (error) {
    console.error('Anthropic analysis error:', error);
    throw error;
  }
}

export async function analyzeSettlement(
  wagerTitle: string,
  wagerDescription: string,
  deadline: string
): Promise<{ winningSide: 'a' | 'b' | null; reasoning: string; confidence: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = `Analyze this wager outcome:

Title: ${wagerTitle}
Description: ${wagerDescription}
Deadline: ${deadline}
Current Date: ${new Date().toISOString()}

Determine the outcome and return JSON:
{"winningSide": "a" or "b" or null, "reasoning": "...", "confidence": 0-100}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      winningSide: parsed.winningSide === 'a' ? 'a' : parsed.winningSide === 'b' ? 'b' : null,
      reasoning: parsed.reasoning || '',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
    };
  } catch (error) {
    console.error('Anthropic settlement analysis error:', error);
    return { winningSide: null, reasoning: 'Analysis failed', confidence: 0 };
  }
}
