# Email Notifications & PWA Mobile Improvements

## Overview

This document outlines the implementation of email notifications and PWA mobile enhancements for the wagr platform.

## Email Notifications

### Implementation

1. **Email Service** (`lib/email-service.ts`)
   - Centralized email sending service
   - Supports multiple email types (wager settlement, welcome, balance updates, etc.)
   - Ready for integration with email providers (Resend, SendGrid, etc.)

2. **Email API Endpoint** (`app/api/notifications/send-email/route.ts`)
   - Handles email sending requests
   - Authenticated via API secret
   - Processes notifications from database triggers

3. **Database Integration** (`scripts/15-add-email-notifications.sql`)
   - Email queue table for async processing
   - Updated notification triggers to queue emails
   - Supports wager resolution, joins, balance updates

### Email Types

- **Wager Settlement**: Sent to all participants when a wager is resolved
  - Winners: "🎉 You won {amount} on '{wager_title}'!"
  - Losers: "Wager resolved: '{wager_title}'"
  - Refunds: "Your wager '{wager_title}' has been refunded"

- **Wager Joined**: Sent to wager creators when someone joins their wager
- **Balance Updates**: Sent for deposits, withdrawals, winnings, losses
- **Welcome**: Sent to new users upon registration

### Setup

1. Run the SQL migration:
   ```sql
   -- Run scripts/15-add-email-notifications.sql
   ```

2. Configure email provider (example with Resend):
   ```typescript
   // In lib/email-service.ts, uncomment and configure:
   const resend = new Resend(process.env.RESEND_API_KEY);
   await resend.emails.send({
     from: 'wagr <noreply@wagr.app>',
     to,
     subject: emailSubject,
     html: htmlContent,
     text: textContent,
   });
   ```

3. Set environment variables:
   ```
   NOTIFICATION_API_SECRET=your-secret-key
   RESEND_API_KEY=your-resend-key (or your email provider key)
   ```

## PWA Mobile Improvements

### 1. Push Notifications

#### Implementation

- **Push Notification Service** (`lib/push-notifications.ts`)
  - Request permission
  - Subscribe/unsubscribe
  - Send notifications
  - VAPID key support

- **Service Worker** (`public/sw.js`)
  - Push event handler
  - Notification click handler
  - Notification close tracking

- **API Endpoints**
  - `/api/push/subscribe` - Save push subscription
  - `/api/push/unsubscribe` - Remove push subscription

- **UI Component** (`components/push-notification-settings.tsx`)
  - Toggle push notifications
  - Shows subscription status
  - Integrated into profile page

#### Setup

1. Generate VAPID keys:
   ```bash
   npm install -g web-push
   web-push generate-vapid-keys
   ```

2. Set environment variables:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
   VAPID_PRIVATE_KEY=your-private-key (for server-side sending)
   ```

3. Run database migration:
   ```sql
   -- Run scripts/16-create-push-subscriptions-table.sql
   ```

4. Enable push notifications in profile settings

### 2. Pull to Refresh

#### Implementation

- **Hook** (`hooks/use-pull-to-refresh.ts`)
  - Detects pull gesture at top of page
  - Triggers refresh callback
  - Visual feedback during pull

- **Integration** (`app/wagers/page.tsx`)
  - Pull to refresh wagers list
  - Visual indicator during refresh
  - Smooth animation

#### Usage

```typescript
const { isRefreshing, pullDistance } = usePullToRefresh({
  onRefresh: () => fetchData(true),
  threshold: 80, // pixels
  disabled: loading,
});
```

### 3. Mobile UX Enhancements

- **Touch Gestures**: Pull-to-refresh implemented
- **Visual Feedback**: Loading indicators, animations
- **Responsive Design**: All components mobile-optimized
- **Service Worker**: Enhanced caching for offline support

## Database Migrations

### Required SQL Scripts

1. `scripts/15-add-email-notifications.sql`
   - Creates email queue table
   - Updates notification triggers
   - Adds email notification functions

2. `scripts/16-create-push-subscriptions-table.sql`
   - Creates push_subscriptions table
   - Sets up RLS policies
   - Adds indexes for performance

## Testing

### Email Notifications

1. Create a test wager
2. Join the wager
3. Wait for settlement or manually resolve
4. Check email inbox for notification

### Push Notifications

1. Enable push notifications in profile
2. Grant browser permission
3. Test notification sending:
   ```typescript
   await sendPushNotification({
     title: 'Test Notification',
     body: 'This is a test',
     data: { url: '/wagers' }
   });
   ```

### Pull to Refresh

1. Open wagers page on mobile
2. Pull down from top
3. Verify refresh indicator appears
4. Confirm data refreshes

## Future Enhancements

1. **Email Provider Integration**
   - Integrate with Resend, SendGrid, or similar
   - Add email templates for all notification types
   - Implement email preferences

2. **Push Notification Features**
   - Rich notifications with images
   - Action buttons
   - Notification grouping
   - Badge updates

3. **Mobile UX**
   - Haptic feedback
   - Swipe gestures
   - Bottom sheet modals
   - Improved animations

## Notes

- Email service currently logs emails (not sending) until provider is configured
- Push notifications require HTTPS in production
- VAPID keys must be generated and configured
- All database migrations must be run before features work

