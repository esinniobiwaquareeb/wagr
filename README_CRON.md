# Quick Start: Getting Cron Jobs Running

## 🚀 Using External Cron Service (Recommended)

wagr uses external cron services to call API endpoints. This works with any hosting provider.

### Quick Setup (cron-job.org - Free)

1. **Sign up**: https://cron-job.org/

2. **Create Cron Job 1 - Settle Wagers:**
   - URL: `https://your-domain.com/api/cron/settle-wagers`
   - Schedule: `* * * * *` (every minute)
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`

3. **Create Cron Job 2 - Generate Wagers:**
   - URL: `https://your-domain.com/api/cron/generate-system-wagers`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`

4. **Set Environment Variables:**
   ```
   CRON_SECRET=WBkfH5uBaJJV4OyMaRv5R18YCGpQ3Pnz4dFNhnSNcMI=
   SYSTEM_WAGER_API_SECRET=YkUg3WB+XRJk1kZob0rYZnctumn99hU0wtLNnTBJZ4M=
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

5. **Done!** Cron jobs will call your API endpoints automatically

## 🧪 Test Locally

1. **Add to `.env.local`:**
   ```env
   CRON_SECRET=WBkfH5uBaJJV4OyMaRv5R18YCGpQ3Pnz4dFNhnSNcMI=
   SYSTEM_WAGER_API_SECRET=YkUg3WB+XRJk1kZob0rYZnctumn99hU0wtLNnTBJZ4M=
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Start dev server:**
   ```bash
   pnpm dev
   ```

3. **Run test script:**
   ```bash
   ./scripts/setup-cron.sh
   ```

   Or test manually:
   ```bash
   curl -X GET "http://localhost:3000/api/cron/settle-wagers" \
     -H "Authorization: Bearer WBkfH5uBaJJV4OyMaRv5R18YCGpQ3Pnz4dFNhnSNcMI="
   ```

## 📚 Full Documentation

See `docs/CRON_SETUP.md` for:
- External cron services
- GitHub Actions setup
- Supabase pg_cron
- Troubleshooting

## 🔑 Get Your Supabase Service Role Key

1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy "service_role" key (keep it secret!)

## ✅ Verify It's Working

**Vercel:**
- Dashboard → Your Project → Settings → Cron Jobs
- Check execution logs

**Local:**
- Run test script: `./scripts/setup-cron.sh`
- Check console for success messages

