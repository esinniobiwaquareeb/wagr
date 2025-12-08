# Supabase to NestJS Migration Guide

This document outlines the migration from Supabase to NestJS backend API.

## Overview

All Supabase database queries and authentication have been replaced with NestJS API calls. The frontend now communicates directly with the NestJS backend using JWT tokens.

## Key Changes

### 1. Authentication
- **Before**: Supabase session tokens stored in cookies
- **After**: JWT tokens from NestJS stored in cookies and localStorage
- **Files Updated**:
  - `lib/auth/server.ts` - Now uses JWT token verification
  - `lib/auth/client.ts` - Uses API routes that proxy to NestJS
  - `app/api/auth/login/route.ts` - Proxies to NestJS `/auth/login`
  - `app/api/auth/register/route.ts` - Proxies to NestJS `/auth/register`
  - `app/api/auth/me/route.ts` - Proxies to NestJS `/auth/me`
  - `app/api/auth/logout/route.ts` - Proxies to NestJS `/auth/logout`
  - `middleware.ts` - Verifies JWT tokens instead of Supabase sessions

### 2. API Client
- **New Files**:
  - `lib/nestjs-client.ts` - Client-side API client for NestJS
  - `lib/nestjs-server.ts` - Server-side API client for NestJS

### 3. Removed Files
- `lib/supabase/client.ts` - Removed
- `lib/supabase/server.ts` - Removed

### 4. Dependencies Removed
- `@supabase/ssr` - Removed from package.json
- `@supabase/supabase-js` - Removed from package.json

## Migration Pattern for Remaining Routes

For any API route that still uses Supabase, follow this pattern:

### Before (Supabase):
```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id);
```

### After (NestJS):
```typescript
import { nestjsGet, nestjsPost, nestjsPatch, nestjsDelete } from '@/lib/nestjs-client';
import { getCurrentUser } from '@/lib/auth/server';

// For server-side routes
const user = await getCurrentUser();
const data = await nestjsGet('/endpoint', { requireAuth: true });
```

## Environment Variables

Add to `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

For production:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

## Remaining Work

The following API routes still need to be migrated (they currently use Supabase):
- Payment webhooks
- Admin routes
- Wager routes
- Quiz routes
- Wallet routes
- Notification routes
- KYC routes
- Bills routes
- And others...

Each route should be updated to:
1. Use `nestjsGet`, `nestjsPost`, `nestjsPatch`, or `nestjsDelete` from `lib/nestjs-client.ts`
2. Get authenticated user via `getCurrentUser()` from `lib/auth/server.ts`
3. Proxy requests to corresponding NestJS endpoints

## Testing

After migration:
1. Test user registration
2. Test user login
3. Test protected routes
4. Test admin routes
5. Verify JWT tokens are stored correctly
6. Verify middleware works with JWT tokens

