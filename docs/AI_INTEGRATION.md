# AI-Powered Wager Generation & Settlement

## Overview

wagr now uses AI to intelligently analyze trending news and generate clear, understandable wagers. The AI also helps with automatic settlement by analyzing outcomes when wagers expire.

## Features

### 1. **AI-Powered Wager Generation**
- Analyzes trending news articles
- Creates clear, understandable wager titles and descriptions
- Generates appropriate deadlines (1-7 days)
- Focuses on events with clear, verifiable outcomes
- Provides reasoning for each wager

### 2. **AI-Powered Settlement**
- Automatically analyzes expired wagers
- Determines winning side based on current events
- Provides confidence scores and reasoning
- Only settles wagers with high confidence (≥70%)

### 3. **Trending News Focus**
- Fetches only trending/popular news (sorted by popularity)
- Filters to last 3 days of news
- Prioritizes most relevant articles

## Setup

### 1. Choose an AI Provider

You can use either **OpenAI** or **Anthropic Claude**:

#### Option A: OpenAI (Recommended)
1. Get API key from https://platform.openai.com/api-keys
2. Add to `.env.local`:
   ```env
   OPENAI_API_KEY=sk-...
   ```

#### Option B: Anthropic Claude
1. Get API key from https://console.anthropic.com/
2. Add to `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   ```

### 2. Environment Variables

Add to your `.env.local`:
```env
# AI Provider (choose one)
OPENAI_API_KEY=sk-...          # For OpenAI GPT-4o-mini
# OR
ANTHROPIC_API_KEY=sk-ant-...   # For Anthropic Claude

# News API (required for politics wagers)
NEWS_API_KEY=your-news-api-key

# Other required variables
CRON_SECRET=your-secret
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key
SYSTEM_WAGER_API_SECRET=your-secret
```

### 3. Deploy to Vercel

Make sure all environment variables are set in your Vercel dashboard.

## How It Works

### Wager Generation Flow

1. **Fetch Trending News**
   - News API fetches political news from last 3 days
   - Sorted by popularity (trending first)
   - Top 5 articles selected

2. **AI Analysis**
   - AI analyzes each article
   - Extracts key events and outcomes
   - Creates clear yes/no questions
   - Generates appropriate deadlines

3. **Wager Creation**
   - AI-generated wagers are created
   - Includes reasoning in `source_data`
   - Marked as `ai_generated: true`

### Settlement Flow

1. **Check Expired Wagers**
   - Finds wagers past deadline without `winning_side`

2. **AI Analysis**
   - AI analyzes current news and events
   - Determines actual outcome
   - Provides confidence score (0-100)

3. **Auto-Settlement**
   - If confidence ≥ 70%, sets `winning_side`
   - Stores AI reasoning in `source_data`
   - Database function settles the wager

## AI Models Used

### OpenAI
- **Model**: `gpt-4o-mini` (cost-effective)
- **Temperature**: 0.7 (generation), 0.3 (settlement)
- **Cost**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens

### Anthropic
- **Model**: `claude-3-haiku-20240307` (fast and cost-effective)
- **Cost**: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens

## Fallback Behavior

If AI is not configured:
- Falls back to simple extraction (no AI)
- Uses article titles directly
- Basic yes/no wagers
- Still creates wagers, but less intelligent

## Testing

### Test Wager Generation
```bash
# Set your API keys in .env.local first
curl -X GET "http://localhost:3000/api/agents/generate-wagers" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Test Settlement
```bash
curl -X GET "http://localhost:3000/api/agents/settle-wagers" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Cost Estimation

For a typical run:
- **5 wagers generated**: ~$0.01-0.02 (OpenAI) or ~$0.02-0.03 (Anthropic)
- **10 wagers settled**: ~$0.01-0.02 (OpenAI) or ~$0.02-0.03 (Anthropic)

**Monthly estimate** (running every 2 minutes):
- ~21,600 wagers/month: ~$4-8/month (OpenAI) or ~$8-12/month (Anthropic)

## Best Practices

1. **Monitor Costs**: Set up billing alerts on your AI provider dashboard
2. **Review Wagers**: Periodically check AI-generated wagers for quality
3. **Adjust Confidence**: Lower confidence threshold (currently 70%) if needed
4. **Manual Override**: Always allow manual settlement for disputed wagers

## Troubleshooting

### AI Not Generating Wagers
- Check API key is set correctly
- Verify API key has sufficient credits
- Check logs for API errors
- Falls back to simple extraction if AI fails

### Settlement Not Working
- Ensure AI key is configured
- Check confidence threshold (70%)
- Review AI reasoning in `source_data`
- Manual settlement still available

### High Costs
- Switch to cheaper model (gpt-4o-mini or claude-haiku)
- Reduce frequency of agent runs
- Add more filtering to reduce wager count

