// OpenAI integration for news analysis and wager generation

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
  tags: string[];
  reasoning: string;
}

export async function analyzeNews(articles: NewsArticle[]): Promise<WagerSuggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Get top 5 trending articles
  const trendingArticles = articles.slice(0, 5);

  const prompt = `You are a wager platform analyst. Analyze these recent news articles and create clear, understandable wagers that users can bet on.

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

For each article, create a wager with:
1. A clear, concise title (max 80 characters) that asks a specific question
2. A description explaining what the wager is about
3. Two sides: Choose the most appropriate side format based on the category and question type
   - Use "Yes/No" for general questions
   - Use "Win/Lose" for competitions
   - Use "Over/Under" for numerical predictions
   - Use "True/False" for factual statements
   - Use "Higher/Lower" for comparisons
   - Use specific names/values for custom outcomes (e.g., team names, specific prices)
4. A deadline within 1-7 days from now
5. The most appropriate category from the list above
6. Relevant tags (2-4 tags)
7. Reasoning for why this is a good wager

Category-specific guidelines:
- crypto: Use "Higher/Lower" or "Over/Under" for prices, "Yes/No" for events
- finance: Use "Higher/Lower" or "Over/Under" for market predictions
- politics: Use "Yes/No" or "Win/Lose" for elections, "True/False" for statements
- sports: Use team names or "Win/Lose" for matches, "Over/Under" for scores
- entertainment: Use "Yes/No" for predictions, specific names for awards
- technology: Use "Yes/No" for launches, "True/False" for features
- religion: Use "Yes/No" or "True/False" for events
- weather: Use "Yes/No" for events, "Over/Under" for temperatures/rainfall

Focus on:
- Events that will have clear, verifiable outcomes
- Current trending topics
- Questions that can be definitively answered
- Avoid vague or subjective topics

Return JSON array with this structure:
[
  {
    "title": "Clear question about the event",
    "description": "Brief explanation",
    "sideA": "Appropriate side option (Yes, Win, Over 100, True, Higher, or specific value)",
    "sideB": "Appropriate side option (No, Lose, Under 100, False, Lower, or alternative)",
    "deadline": "ISO date string (1-7 days from now)",
    "category": "One of: crypto, finance, politics, sports, entertainment, technology, religion, weather",
    "tags": ["tag1", "tag2", "tag3"],
    "reasoning": "Why this wager makes sense"
  }
]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing news and creating clear, wagerable questions. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    const wagers = Array.isArray(parsed) ? parsed : parsed.wagers || [];

    // Validate and format wagers
    return wagers.map((w: any) => ({
      title: w.title || 'Unknown wager',
      description: w.description || '',
      sideA: w.sideA || 'Yes',
      sideB: w.sideB || 'No',
      deadline: w.deadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      category: w.category || 'politics',
      tags: Array.isArray(w.tags) ? w.tags : ['politics', 'news'],
      reasoning: w.reasoning || '',
    })).slice(0, 5);
  } catch (error) {
    console.error('OpenAI analysis error:', error);
    throw error;
  }
}

export async function analyzeSettlement(
  wagerTitle: string,
  wagerDescription: string,
  deadline: string
): Promise<{ winningSide: 'a' | 'b' | null; reasoning: string; confidence: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `Analyze this wager to determine the outcome:

Title: ${wagerTitle}
Description: ${wagerDescription}
Deadline: ${deadline}
Current Date: ${new Date().toISOString()}

Based on current news and information, determine:
1. Has the deadline passed? (Current date vs deadline)
2. What is the actual outcome?
3. Which side (A or B) won?
4. Your confidence level (0-100)

Return JSON:
{
  "winningSide": "a" or "b" or null,
  "reasoning": "Explanation of the outcome",
  "confidence": 0-100
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing events and determining outcomes. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const parsed = JSON.parse(content);

    return {
      winningSide: parsed.winningSide === 'a' ? 'a' : parsed.winningSide === 'b' ? 'b' : null,
      reasoning: parsed.reasoning || '',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
    };
  } catch (error) {
    console.error('OpenAI settlement analysis error:', error);
    return { winningSide: null, reasoning: 'Analysis failed', confidence: 0 };
  }
}
