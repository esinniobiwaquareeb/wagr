# Vercel AI Agents Setup

## Overview
wagr uses Vercel AI Agents (Cron Jobs) to automate wager generation and settlement. These agents replace external cron services and run directly on Vercel.

## Available Agents

### 1. Wager Generation Agent
**Endpoint**: `/api/agents/generate-wagers`
**Purpose**: Automatically aggregates data from various sources and creates system-generated wagers
**Schedule**: Every 2 minutes (for testing) - can be adjusted in Vercel dashboard

**What it does**:
- Fetches cryptocurrency prices (CoinGecko)
- Fetches stock and forex data (Alpha Vantage - if configured)
- Fetches political news (News API - if configured)
- Generates wagers based on current events and market data
- Prevents duplicate wagers

### 2. Settlement Agent
**Endpoint**: `/api/agents/settle-wagers`
**Purpose**: Handles wager settlement, winnings computation, and distribution
**Schedule**: Every minute

**What it does**:
- Checks for expired wagers (deadline passed)
- **Uses AI to determine outcomes for wagers without winning_side** (if AI configured)
- Calculates total pool and platform fee (5%)
- Distributes winnings proportionally to winners
- Handles refunds for single-participant wagers
- Records all transactions

## Setup Instructions

### 1. Configure Vercel Cron Jobs

The `vercel.json` file is already configured with the cron schedules:

```json
{
  "crons": [
    {
      "path": "/api/agents/generate-wagers",
      "schedule": "*/2 * * * *"
    },
    {
      "path": "/api/agents/settle-wagers",
      "schedule": "* * * * *"
    }
  ]
}
```

### 2. Set Environment Variables

In your Vercel dashboard, ensure these environment variables are set:

**Required**:
- `CRON_SECRET` - Secret key for authenticating cron requests
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (bypasses RLS)
- `SYSTEM_WAGER_API_SECRET` - Secret for system wager creation

**Optional** (for enhanced wager generation):
- `ALPHA_VANTAGE_API_KEY` - For finance/stock wagers
- `NEWS_API_KEY` - For politics/news wagers
- `OPENAI_API_KEY` - For AI-powered wager generation (recommended)
- `ANTHROPIC_API_KEY` - Alternative AI provider (Claude)

### 3. Deploy to Vercel

After deploying, Vercel will automatically:
- Register the cron jobs
- Execute them according to the schedule
- Send authorization header with `CRON_SECRET`

### 4. AI Integration (Optional but Recommended)

For intelligent wager generation and automatic settlement:

1. **Choose AI Provider**:
   - **OpenAI** (Recommended): Get key from https://platform.openai.com/api-keys
   - **Anthropic**: Get key from https://console.anthropic.com/

2. **Add to Environment Variables**:
   ```env
   # Choose one:
   OPENAI_API_KEY=sk-...
   # OR
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Benefits**:
   - **Wager Generation**: AI analyzes trending news and creates clear, understandable wagers
   - **Settlement**: AI automatically determines outcomes for expired wagers (confidence ≥70%)

See [AI_INTEGRATION.md](./AI_INTEGRATION.md) for detailed documentation.

### 5. Adjust Schedules (Optional)

To change the schedule, update `vercel.json`:

**Common Cron Patterns**:
- `*/2 * * * *` - Every 2 minutes (testing)
- `*/5 * * * *` - Every 5 minutes
- `0 */6 * * *` - Every 6 hours
- `0 * * * *` - Every hour
- `* * * * *` - Every minute

**For Production**:
- Wager Generation: `0 */6 * * *` (every 6 hours) or `0 * * * *` (every hour)
- Settlement: `* * * * *` (every minute) - keep this frequent

### 6. Monitor Agent Execution

Check Vercel dashboard:
- Go to your project → Functions → Cron Jobs
- View execution logs and history
- Monitor for errors

## Testing Agents Manually

### Test Wager Generation Agent:
```bash
curl -X GET "https://your-domain.com/api/agents/generate-wagers" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Settlement Agent:
```bash
curl -X GET "https://your-domain.com/api/agents/settle-wagers" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Platform Commission

The platform commission is set to **5%** (0.05) across the application:
- Applied to all new wagers
- Deducted from total pool before winnings distribution
- Updated in database, API routes, and UI components

## Migration

If upgrading from external cron services:

1. **Run the commission update migration**:
   ```sql
   -- Execute scripts/22-update-commission-to-5-percent.sql in Supabase SQL Editor
   ```

2. **Update environment variables** in Vercel dashboard

3. **Remove external cron jobs** (cron-job.org, EasyCron, etc.)

4. **Deploy to Vercel** - cron jobs will be automatically registered

## Troubleshooting

### Agents not running?
- Check Vercel dashboard for cron job status
- Verify `CRON_SECRET` is set correctly
- Check function logs in Vercel dashboard

### Wagers not generating?
- Verify API keys are set (if using external APIs)
- Check function execution logs
- Ensure `SYSTEM_WAGER_API_SECRET` is configured

### Settlement not working?
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check database function `check_and_settle_expired_wagers()` exists
- Review function logs for errors

## Notes

- Agents use Edge Runtime for better performance
- Maximum execution time: 5 minutes
- All agents require `CRON_SECRET` authentication
- Agents automatically handle errors and continue processing

