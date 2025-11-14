# External Cron Service Setup

Since wagr uses external cron services instead of Vercel's built-in cron, you need to configure an external service to call the API endpoints.

## API Endpoints

### 1. Settle Wagers
- **URL**: `https://your-domain.com/api/cron/settle-wagers`
- **Method**: GET
- **Schedule**: Every minute (`* * * * *`)
- **Header**: `Authorization: Bearer YOUR_CRON_SECRET`

### 2. Generate System Wagers
- **URL**: `https://your-domain.com/api/cron/generate-system-wagers`
- **Method**: GET
- **Schedule**: Every 6 hours (`0 */6 * * *`)
- **Header**: `Authorization: Bearer YOUR_CRON_SECRET`

## Recommended Services

### Option 1: cron-job.org (Free)

1. **Sign up**: https://cron-job.org/
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

3. **Create Cron Job 2 - Generate Wagers:**
   - Title: "Generate System Wagers"
   - URL: `https://your-domain.com/api/cron/generate-system-wagers`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Request Method: GET
   - HTTP Headers:
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     ```
   - Activate: Yes

### Option 2: EasyCron (Free tier available)

1. **Sign up**: https://www.easycron.com/
2. **Create similar cron jobs** with same settings as above

### Option 3: GitHub Actions (Free for public repos)

Create `.github/workflows/cron.yml`:

```yaml
name: Cron Jobs

on:
  schedule:
    - cron: '* * * * *'  # Every minute - settle wagers
    - cron: '0 */6 * * *'  # Every 6 hours - generate wagers
  workflow_dispatch:  # Manual trigger

jobs:
  settle-wagers:
    runs-on: ubuntu-latest
    if: github.event.schedule == '* * * * *' || github.event_name == 'workflow_dispatch'
    steps:
      - name: Settle Wagers
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/settle-wagers" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  generate-wagers:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 */6 * * *' || github.event_name == 'workflow_dispatch'
    steps:
      - name: Generate System Wagers
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/generate-system-wagers" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secrets in GitHub:
- `APP_URL`: Your deployed app URL
- `CRON_SECRET`: Your cron secret

### Option 4: Supabase Edge Functions + pg_cron

If using Supabase, you can use pg_cron extension:

1. Enable `pg_cron` in Supabase Dashboard → Database → Extensions
2. Create scheduled jobs (requires pg_net extension):

```sql
-- Note: This requires pg_net extension
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

## Environment Variables

Make sure these are set in your deployment:

```env
CRON_SECRET=your-secret-key-here
SYSTEM_WAGER_API_SECRET=your-api-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing

Test your cron endpoints manually:

```bash
# Test settle wagers
curl -X GET "https://your-domain.com/api/cron/settle-wagers" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test generate wagers
curl -X GET "https://your-domain.com/api/cron/generate-system-wagers" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "message": "..."
}
```

## Monitoring

- Check your cron service dashboard for execution logs
- Monitor your application logs for errors
- Set up alerts for failed cron jobs if your service supports it

