# Environment Variables Cleanup

## ✅ Cleaned Up `.env.local`

The `.env.local` file has been cleaned up to remove backend-specific variables since the backend is now separate in `wagr-backend`.

## 📋 What Was Removed

The following variables are **no longer needed** in the frontend (they're now in `wagr-backend`):

- ❌ `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_URL` - Redis is now in backend
- ❌ `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Database is now in backend
- ❌ `JWT_SECRET`, `JWT_EXPIRES_IN` - JWT handled by backend
- ❌ Any other backend-specific database/Redis configuration

## ✅ What Was Kept

The following variables are **still needed** in the frontend:

### API Configuration
- ✅ `NEXT_PUBLIC_API_URL` - Points to NestJS backend
  - Local: `http://localhost:3000/api/v1`
  - Production: `https://wagr-backend.vercel.app/api/v1`
- ✅ `NEXT_PUBLIC_APP_URL` - Frontend URL
- ✅ `NEXT_PUBLIC_APP_URL` - Site URL for PWA, email links

### Supabase (if still using)
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - If using Supabase for storage
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - If needed for frontend operations

### Payments
- ✅ `PAYSTACK_SECRET_KEY` - If still processing payments in frontend

### Cron Jobs & System Operations
- ✅ `SYSTEM_WAGER_API_SECRET` - For system wager generation
- ✅ `CRON_SECRET` - For cron job authentication

### Email
- ✅ `SMTP_*` variables - If sending emails from frontend
- ✅ `SUPPORT_EMAIL` - Support email address

### AI & External APIs
- ✅ `OPENAI_API_KEY` - For AI features
- ✅ `ANTHROPIC_API_KEY` - Alternative AI service
- ✅ `ALPHA_VANTAGE_API_KEY` - Financial data
- ✅ `NEWS_API_KEY` - News data

### Push Notifications
- ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Web push public key
- ✅ `VAPID_PRIVATE_KEY` - Web push private key
- ✅ `VAPID_EMAIL` - VAPID contact email

## 🔄 Migration Steps

1. **Backup your current `.env.local`**:
   ```bash
   cp .env.local .env.local.backup
   ```

2. **Replace with cleaned version**:
   ```bash
   cp .env.local.cleaned .env.local
   ```

3. **Update `NEXT_PUBLIC_API_URL`** for production:
   ```bash
   # In .env.local, change:
   NEXT_PUBLIC_API_URL=https://wagr-backend.vercel.app/api/v1
   ```

4. **Update secrets** (if needed):
   - Update `SYSTEM_WAGER_API_SECRET` and `CRON_SECRET` if you changed them
   - Update any API keys if needed

## 📝 Production Environment Variables

For Vercel deployment, set these in Vercel Dashboard:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://wagr-backend.vercel.app/api/v1
NEXT_PUBLIC_APP_URL=https://wagered.app
NEXT_PUBLIC_APP_URL=https://wagered.app

# Supabase (if still using)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Payments
PAYSTACK_SECRET_KEY=sk_live_...

# Cron Jobs
SYSTEM_WAGER_API_SECRET=your-secret
CRON_SECRET=your-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=wagr <noreply@wagr.app>
SUPPORT_EMAIL=support@wagr.app

# AI (optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# External APIs (optional)
ALPHA_VANTAGE_API_KEY=your-key
NEWS_API_KEY=your-key

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_EMAIL=mailto:hello@wagered.app
```

## ⚠️ Important Notes

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Backend variables** are now in `wagr-backend/.env.local` or Vercel environment variables
3. **Update API URL** to point to your production backend
4. **Keep secrets secure** - Rotate them if exposed

## 🔍 Verification

After cleanup, verify:
- ✅ Frontend can connect to backend API
- ✅ Payments work (if using Paystack in frontend)
- ✅ Email sending works (if using SMTP in frontend)
- ✅ Push notifications work
- ✅ AI features work (if using)

---

**The cleaned `.env.local` is ready!** Just update `NEXT_PUBLIC_API_URL` to point to your production backend. 🎉

