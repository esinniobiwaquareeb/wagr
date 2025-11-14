# Cron Jobs Setup Guide

## Overview
wagr uses external cron services to call API endpoints. The API endpoints are ready to receive requests from any cron service.

Two cron jobs are needed:
1. **Settle Wagers** - Runs every minute to settle expired wagers
2. **Generate System Wagers** - Runs every 6 hours to create new wagers from external APIs

## Option 1: cron-job.org (Recommended - Free)

### Setup Steps:

1. **Sign up at https://cron-job.org/**

2. **Create Cron Job 1 - Settle Wagers:**
   - Title: "Settle Wagers"
   - URL: `https://your-domain.com/api/cron/settle-wagers`
   - Schedule: `* * * * *` (every minute)
   - Request Method: GET
   - HTTP Headers: 
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     ```
   - Activate: Yes

3. **Create Cron Job 2 - Generate System Wagers:**
   - Title: "Generate System Wagers"
   - URL: `https://your-domain.com/api/cron/generate-system-wagers`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Request Method: GET
   - HTTP Headers:
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     ```
   - Activate: Yes

4. **Set Environment Variables in your hosting:**
   ```
   CRON_SECRET=your-secret-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SYSTEM_WAGER_API_SECRET=your-api-secret
   ALPHA_VANTAGE_API_KEY=your-key (optional)
   NEWS_API_KEY=your-key (optional)
   ```

5. **Test Manually:**
   ```bash
   curl -X GET "https://your-domain.com/api/cron/settle-wagers" \
     -H "Authorization: Bearer your-cron-secret"
   ```

## Option 2: Manual Testing (Development)

### Test Cron Jobs Locally:

1. **Start your development server:**
   ```bash
   pnpm dev
   ```

2. **Test Settle Wagers:**
   ```bash
   curl -X GET "http://localhost:3000/api/cron/settle-wagers" \
     -H "Authorization: Bearer your-cron-secret"
   ```

3. **Test Generate System Wagers:**
   ```bash
   curl -X GET "http://localhost:3000/api/cron/generate-system-wagers" \
     -H "Authorization: Bearer your-cron-secret"
   ```

### Or use a browser/Postman:
- URL: `http://localhost:3000/api/cron/settle-wagers`
- Method: GET
- Headers: `Authorization: Bearer your-cron-secret`

## Option 3: EasyCron (Free tier available)

1. **Sign up at https://www.easycron.com/**
2. **Create cron jobs with same settings as Option 1**

## Option 4: GitHub Actions (Free for public repos)

Create `.github/workflows/cron.yml`:

```yaml
name: Cron Jobs

on:
  schedule:
    - cron: '* * * * *'  # Every minute
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  settle-wagers:
    runs-on: ubuntu-latest
    steps:
      - name: Settle Wagers
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/settle-wagers" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
  
  generate-wagers:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 */6 * * *'
    steps:
      - name: Generate System Wagers
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/generate-system-wagers" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secrets in GitHub:
- `APP_URL`: Your deployed app URL
- `CRON_SECRET`: Your cron secret

## Option 5: Supabase Edge Functions + pg_cron

If using Supabase, you can use pg_cron extension:

1. **Enable pg_cron in Supabase:**
   - Go to Database → Extensions
   - Enable `pg_cron` and `pg_net`

2. **Create database functions that call your API:**
   ```sql
   -- This requires pg_net extension
   SELECT cron.schedule(
     'settle-wagers',
     '* * * * *',
     $$
     SELECT net.http_get(
       url:='https://your-app.com/api/cron/settle-wagers',
       headers:='{"Authorization": "Bearer your-cron-secret"}'::jsonb
     );
     $$
   );
   
   SELECT cron.schedule(
     'generate-wagers',
     '0 */6 * * *',
     $$
     SELECT net.http_get(
       url:='https://your-app.com/api/cron/generate-system-wagers',
       headers:='{"Authorization": "Bearer your-cron-secret"}'::jsonb
     );
     $$
   );
   ```

## Environment Variables Required

Create `.env.local` file:

```env
# Required for cron jobs
CRON_SECRET=generate-a-random-secret-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Required for system wager generation
SYSTEM_WAGER_API_SECRET=generate-a-random-secret-here

# Optional - for real data (works without keys using mock data)
ALPHA_VANTAGE_API_KEY=your-key-here
NEWS_API_KEY=your-key-here

# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Generate Secure Secrets

Use these commands to generate secure secrets:

```bash
# Generate CRON_SECRET
openssl rand -base64 32

# Generate SYSTEM_WAGER_API_SECRET
openssl rand -base64 32
```

## Verify Cron Jobs Are Working

1. **Check Vercel Dashboard:**
   - Go to your project → Functions → Cron Jobs
   - Check execution logs

2. **Check Application Logs:**
   - Look for success/error messages in your logs
   - Successful response: `{ "success": true, "message": "..." }`

3. **Test Database:**
   - Check if expired wagers are being settled
   - Check if new system wagers are being created

## Troubleshooting

### Cron job returns 401 Unauthorized:
- Check that `CRON_SECRET` is set correctly
- Verify the Authorization header format: `Bearer your-secret`

### Cron job returns 500 Error:
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify database functions exist (run migration scripts)
- Check application logs for detailed error messages

### Cron jobs not running on Vercel:
- Ensure `vercel.json` is in the root directory
- Verify the cron schedule format is correct
- Check Vercel project settings for cron job configuration
- Make sure you're on a paid plan (Hobby plan supports cron jobs)

### Testing locally:
- Make sure your dev server is running
- Use the correct localhost URL
- Set environment variables in `.env.local`

## Quick Start (External Cron Service)

1. **Deploy your application** (Vercel, Railway, Render, etc.)
2. **Set environment variables** in your hosting platform
3. **Set up cron jobs** on cron-job.org or similar service
4. **Done!** Cron jobs will call your API endpoints automatically

See `docs/EXTERNAL_CRON_SETUP.md` for detailed instructions.

