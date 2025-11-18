# External Cron Job Setup

## Overview

Since Vercel Hobby plan has limitations on cron jobs, you can use external cron job services to trigger the agent endpoints.

## Available Endpoints

### 1. Wager Generation Agent
**Endpoint**: `/api/agents/generate-wagers`
**Method**: GET
**Authentication**: Bearer token with `CRON_SECRET`

### 2. Wager Settlement Agent
**Endpoint**: `/api/agents/settle-wagers`
**Method**: GET
**Authentication**: Bearer token with `CRON_SECRET`

## Recommended External Cron Services

### Option 1: cron-job.org (Free)
1. Sign up at https://cron-job.org
2. Create a new cron job
3. Set URL: `https://your-domain.com/api/agents/generate-wagers`
4. Set HTTP Header: `Authorization: Bearer YOUR_CRON_SECRET`
5. Set schedule (e.g., every 6 hours or daily)
6. Repeat for settlement endpoint

### Option 2: EasyCron (Free tier available)
1. Sign up at https://www.easycron.com
2. Create cron job with your endpoint URL
3. Add custom header: `Authorization: Bearer YOUR_CRON_SECRET`
4. Set desired schedule

### Option 3: GitHub Actions (Free)
Create `.github/workflows/cron.yml`:
```yaml
name: Wager Agents
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Wagers
        run: |
          curl -X GET "https://your-domain.com/api/agents/generate-wagers" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
  
  settle:
    runs-on: ubuntu-latest
    steps:
      - name: Settle Wagers
        run: |
          curl -X GET "https://your-domain.com/api/agents/settle-wagers" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Recommended Schedules

### Wager Generation
- **Development/Testing**: Every 2-5 minutes
- **Production**: Every 6 hours or daily

### Wager Settlement
- **Development/Testing**: Every minute
- **Production**: Every hour or every 6 hours

## Security

Make sure to:
1. Set `CRON_SECRET` environment variable in your Vercel project
2. Use the same secret in your external cron job service
3. Never commit the secret to version control
4. Use HTTPS for all cron job requests

## Testing

Test endpoints manually:
```bash
# Test wager generation
curl -X GET "https://your-domain.com/api/agents/generate-wagers" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test settlement
curl -X GET "https://your-domain.com/api/agents/settle-wagers" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

