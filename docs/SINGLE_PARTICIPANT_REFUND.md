# Single Participant Auto-Refund System

## Overview
The wagr platform automatically refunds users when they are the only participant in a wager. This ensures transparency and fairness.

## How It Works

### Automatic Triggers

The system checks for single participants in **three ways**:

1. **When Wager Expires (Cron Job)** - Primary mechanism
   - The cron job at `/api/cron/settle-wagers` runs periodically (recommended: every minute)
   - Calls `check_and_settle_expired_wagers()` which first checks for single participants
   - Automatically refunds expired wagers with only 1 participant

2. **When Someone Tries to Join an Expired Wager** - Immediate check
   - If a user tries to join a wager that has expired with only 1 participant
   - The system immediately triggers the refund before allowing the join
   - User sees a message that the wager was automatically refunded

3. **When Viewing Wager Details** - Background check
   - When a wager detail page loads, it checks if the wager expired with 1 participant
   - Triggers auto-refund in the background if needed
   - Refreshes the page to show updated status

### Database Functions

1. **`check_and_refund_single_participants()`**
   - Finds expired wagers (deadline passed, status OPEN)
   - Checks participant count for each
   - If only 1 participant, refunds them automatically
   - Updates wager status to RESOLVED

2. **`settle_wager(wager_id_param uuid)`**
   - Updated to check participant count first
   - If only 1 participant, refunds immediately (even if winning_side is set)
   - Then proceeds with normal settlement logic

3. **`check_and_settle_expired_wagers()`**
   - First calls `check_and_refund_single_participants()`
   - Then processes normal wager settlements

## Setup

### Required: Cron Job Setup

You **must** set up a cron job to call the settlement endpoint:

1. **Use an external cron service** (cron-job.org, EasyCron, etc.)
2. **Configure the cron job:**
   - URL: `https://your-domain.com/api/cron/settle-wagers`
   - Schedule: `* * * * *` (every minute)
   - Method: GET
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`
3. **Set environment variable:**
   ```
   CRON_SECRET=your-secret-key-here
   ```

### Optional: Immediate Checks

The immediate checks (when joining/viewing) work automatically without any setup. They provide instant refunds for expired single-participant wagers.

## Transaction Descriptions

All refunds include clear descriptions:

- **Single participant refund (on settlement):** `"Refund: '[Wager Title]' - Only participant, wager cancelled"`
- **Auto-refund (on deadline):** `"Auto-Refund: '[Wager Title]' - Only participant, deadline passed"`

## Notifications

Users receive notifications when their single-participant wager is refunded:
- Title: "Wager Refunded"
- Message: "Your wager '[title]' has been refunded. You were the only participant."

## Important Notes

- **Cron is required** for automatic processing of expired wagers
- **Immediate checks** provide instant refunds when users interact with expired wagers
- **No fees** are charged on single-participant refunds
- **Full refund** - users get back 100% of their entry amount
- Refunds happen **automatically** - no manual intervention needed

