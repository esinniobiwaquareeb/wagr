# Automatic Wager Settlement System

## Overview
The wagr platform includes an automatic settlement system that resolves wagers when their deadline passes and distributes winnings to participants.

## How It Works

### Database Functions

1. **`settle_wager(wager_id_param uuid)`**
   - Settles a specific wager
   - Calculates total pool from all entries
   - Deducts platform fee (5%)
   - Distributes winnings proportionally to winners
   - Refunds all participants if no winners
   - Updates wager status to 'RESOLVED'

2. **`check_and_settle_expired_wagers()`**
   - Checks for wagers that have passed their deadline
   - Only processes wagers with:
     - Status = 'OPEN'
     - Deadline <= current time
     - Winning side is set (not null)
   - Calls `settle_wager()` for each expired wager

### Cron Job Setup

The system uses a cron job endpoint at `/api/cron/settle-wagers` that:
- Runs every minute (configurable)
- Requires authentication via `CRON_SECRET` environment variable
- Calls the database function to check and settle expired wagers

### Setup Instructions

1. **Run the SQL migration:**
   ```sql
   -- Execute scripts/04-automatic-wager-settlement.sql in Supabase SQL Editor
   ```

2. **Set up Vercel Cron (if using Vercel):**
   - The `vercel.json` file is already configured
   - Add `CRON_SECRET` environment variable in Vercel dashboard

3. **Alternative: Use Supabase Edge Functions or Database Webhooks:**
   - Create a scheduled function that calls `check_and_settle_expired_wagers()`
   - Or use pg_cron extension if available

### Important Notes

- Wagers must have a `winning_side` set before deadline for automatic settlement
- If no winning side is set, wagers remain OPEN (manual resolution required)
- Platform fee is fixed at 5% (0.05)
- Winnings are distributed proportionally based on entry amounts
- All transactions are recorded in the `transactions` table

