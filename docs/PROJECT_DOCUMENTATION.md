# wagr - Betting Platform Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Core Features](#core-features)
4. [Technical Stack](#technical-stack)
5. [Database Schema](#database-schema)
6. [User Roles](#user-roles)
7. [Key Workflows](#key-workflows)
8. [API Endpoints](#api-endpoints)
9. [Security Features](#security-features)
10. [Deployment & Configuration](#deployment--configuration)

---

## Project Overview

**wagr** is a comprehensive real-time betting/wagering platform that allows users to create, join, and manage wagers on various topics including sports, finance, politics, entertainment, and more. The platform features automated wager generation, automatic settlement, payment processing, and a complete admin management system.

### Key Highlights
- **Real-time Updates**: Live wager status, participant counts, and notifications
- **Automated Systems**: System-generated wagers from external APIs and automatic settlement
- **Payment Integration**: Paystack integration for deposits and withdrawals
- **Admin Panel**: Complete admin interface for managing users, wagers, and transactions
- **PWA Support**: Progressive Web App with offline capabilities
- **Smart Caching**: Optimized caching strategy for improved performance
- **Responsive Design**: Mobile-first design with desktop optimization

---

## Architecture

### Frontend
- **Framework**: Next.js 16.0.3 (App Router)
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 4.1.9
- **Components**: Shadcn UI (Radix UI primitives)
- **State Management**: React Hooks (useState, useCallback, useMemo)
- **Caching**: Custom cache utility with sessionStorage and memory cache

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **API Routes**: Next.js API Routes
- **Payment Processing**: Paystack
- **Real-time**: Supabase Realtime subscriptions

### Infrastructure
- **Hosting**: Vercel (or compatible platform)
- **Cron Jobs**: External cron service (cron-job.org, EasyCron, etc.)
- **Service Worker**: Custom PWA service worker

---

## Core Features

### 1. User Management
- **Authentication**: Email/password authentication with Supabase
- **Profile Management**: Username, avatar, balance tracking
- **Separate Admin Auth**: Admins must use dedicated admin login page
- **User Preferences**: Category preferences, custom categories, notification settings

### 2. Wager System
- **Create Wagers**: Users can create custom wagers with:
  - Title and description
  - Two sides (Side A vs Side B)
  - Entry amount
  - Optional deadline
  - Category and tags
  - Public/private visibility
- **Join Wagers**: Users can join existing wagers by choosing a side
- **Potential Returns**: Real-time calculation of potential winnings based on current pool
- **Wager Status**: OPEN, RESOLVED, REFUNDED
- **Wager Deletion**: Creators can delete wagers if no other participants

### 3. Automated Wager Generation
- **System Wagers**: Automatically generated wagers from:
  - Cryptocurrency prices (CoinGecko API)
  - Stock market indices (Alpha Vantage API)
  - Political events (News API)
  - Sports events
  - Weather forecasts
  - Entertainment events
- **Cron Job**: Runs every 6 hours to generate new wagers
- **Duplicate Prevention**: System prevents duplicate wagers

### 4. Automatic Settlement
- **Settlement Function**: Database function that:
  - Calculates total pool
  - Deducts platform fee (1%)
  - Distributes winnings proportionally to winners
  - Handles refunds for single-participant wagers
  - Updates wager status
- **Cron Job**: Runs every minute to settle expired wagers
- **Single Participant Refund**: Automatic refund if only one participant when deadline passes

### 5. Payment System
- **Deposits**: Paystack integration for adding funds
- **Transactions**: Complete transaction history with descriptions
- **Balance Management**: Real-time balance updates
- **Transaction Types**:
  - `deposit`: User deposits
  - `wager_join`: Joining a wager
  - `wager_win`: Winning a wager
  - `wager_refund`: Refund from wager
  - `withdrawal`: Withdrawing funds (if implemented)

### 6. Notifications
- **Real-time Notifications**: Supabase Realtime for instant updates
- **Notification Types**:
  - Wager resolved (win/loss/refund)
  - Someone joined your wager
  - System notifications
- **Notification Center**: Dedicated notifications page with mark as read/delete

### 7. Admin Panel
- **Admin Dashboard**: Overview with statistics
- **User Management**: View all users, balances, roles, join dates
- **Wager Management**: View all wagers, resolve wagers, delete wagers
- **Transaction Management**: View all transactions across the platform
- **Admin Authentication**: Separate login page for admins only

### 8. Leaderboard
- **Top Performers**: Users ranked by total winnings
- **Real-time Updates**: Live leaderboard updates

### 9. Preferences & Filtering
- **Category Preferences**: Users can set preferred categories
- **Custom Categories**: Users can create custom categories
- **Tag Filtering**: Filter wagers by tags
- **Home Page Filtering**: Wagers filtered based on user preferences

### 10. Caching Strategy
- **Client-side Caching**: In-memory and sessionStorage caching
- **Stale-while-revalidate**: Background refresh of stale data
- **Cache TTLs**: Configurable time-to-live for different data types
- **Service Worker**: Enhanced caching for PWA

---

## Technical Stack

### Dependencies
```json
{
  "next": "16.0.3",
  "react": "19.2.0",
  "react-dom": "19.2.0",
  "@supabase/supabase-js": "latest",
  "@supabase/ssr": "latest",
  "tailwindcss": "^4.1.9",
  "@radix-ui/*": "various",
  "date-fns": "latest",
  "lucide-react": "^0.454.0",
  "zod": "3.25.76"
}
```

### Key Libraries
- **Supabase**: Database, authentication, real-time
- **Paystack**: Payment processing
- **Radix UI**: Accessible component primitives
- **date-fns**: Date formatting and manipulation
- **lucide-react**: Icon library

---

## Database Schema

### Core Tables

#### `profiles`
- `id` (uuid, PK, FK → auth.users)
- `username` (text, unique)
- `avatar_url` (text)
- `balance` (numeric, default 0)
- `is_admin` (boolean, default false)
- `created_at` (timestamptz)

#### `wagers`
- `id` (uuid, PK)
- `creator_id` (uuid, FK → auth.users)
- `title` (text, required)
- `description` (text)
- `amount` (numeric, required)
- `side_a` (text, required)
- `side_b` (text, required)
- `deadline` (timestamptz)
- `status` (text, default 'OPEN')
- `winning_side` (text)
- `fee_percentage` (numeric, default 0.01)
- `currency` (text)
- `category` (text)
- `tags` (text[])
- `is_system_generated` (boolean, default false)
- `is_public` (boolean, default true)
- `source_data` (jsonb)
- `created_at` (timestamptz)

#### `wager_entries`
- `id` (uuid, PK)
- `wager_id` (uuid, FK → wagers)
- `user_id` (uuid, FK → auth.users)
- `side` (text, required)
- `amount` (numeric, required)
- `created_at` (timestamptz)

#### `transactions`
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `type` (text, required)
- `amount` (numeric, required)
- `reference` (text)
- `description` (text)
- `created_at` (timestamptz)

#### `notifications`
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `type` (text, required)
- `title` (text, required)
- `message` (text, required)
- `link` (text)
- `read` (boolean, default false)
- `metadata` (jsonb)
- `created_at` (timestamptz)

#### `user_preferences`
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, unique)
- `preferred_categories` (text[])
- `preferred_tags` (text[])
- `custom_categories` (text[])
- `notification_enabled` (boolean, default true)
- `notification_types` (text[])
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### Database Functions
- `settle_wager(wager_id_param uuid)`: Settles a specific wager
- `check_and_settle_expired_wagers()`: Checks and settles expired wagers
- `check_and_refund_single_participants()`: Refunds single-participant wagers
- `notify_wager_resolved()`: Creates notifications for resolved wagers
- `notify_wager_joined()`: Creates notifications when someone joins a wager
- `mark_all_notifications_read()`: Marks all user notifications as read
- `get_unread_notification_count()`: Returns unread notification count

---

## User Roles

### Regular User
- Create and join wagers
- Manage wallet and deposits
- View notifications
- Set preferences
- View leaderboard
- Cannot access admin panel
- Must use regular login (not admin login)

### Admin
- All regular user capabilities
- Access admin dashboard
- View all users, wagers, transactions
- Resolve wagers manually
- Delete any wager
- Must use admin login page (cannot use regular login)
- Separate admin sidebar navigation

---

## Key Workflows

### 1. User Registration & Login
1. User clicks "Login" or "Sign Up"
2. Enters email and password
3. System checks if user is admin
4. If admin: Sign out and redirect to admin login
5. If regular user: Complete authentication
6. Profile created automatically if doesn't exist

### 2. Creating a Wager
1. User navigates to "Create Wager" page
2. Fills in wager details (title, sides, amount, deadline, category)
3. Submits wager
4. System validates:
   - User has sufficient balance
   - All required fields
   - Deadline is in future (if provided)
5. Wager created and visible on home page

### 3. Joining a Wager
1. User views wager on home page or detail page
2. Clicks "Join" button
3. Selects side (A or B)
4. System validates:
   - User is authenticated
   - User has sufficient balance
   - Wager is still open
   - Deadline hasn't passed
5. Balance deducted, entry created
6. Notification sent to wager creator
7. Potential returns updated in real-time

### 4. Wager Settlement
1. Admin sets winning side (or system determines)
2. Deadline passes
3. Cron job calls settlement function
4. System:
   - Calculates total pool
   - Deducts 1% platform fee
   - Distributes winnings proportionally
   - Updates all balances
   - Creates transaction records
   - Sends notifications to participants
   - Updates wager status to RESOLVED

### 5. Single Participant Refund
1. Wager deadline passes
2. System checks if only one participant
3. If true:
   - Refund full amount to participant
   - Update wager status to REFUNDED
   - Create transaction record
   - Send notification

### 6. Deposit Flow
1. User navigates to Wallet page
2. Enters deposit amount (minimum ₦100)
3. Clicks "Deposit"
4. System initializes Paystack payment
5. User redirected to Paystack checkout
6. User completes payment
7. Paystack redirects back with reference
8. System verifies payment
9. Balance updated, transaction recorded
10. User redirected to wallet with success message

### 7. Admin Wager Resolution
1. Admin navigates to Wagers page
2. Selects a wager
3. Clicks "Resolve" button
4. Selects winning side (A or B)
5. System:
   - Updates wager with winning side
   - Calls settlement function
   - Distributes winnings
   - Updates all balances
   - Sends notifications

---

## API Endpoints

### Public Endpoints
- `GET /`: Home page
- `GET /wager/[id]`: Wager detail page
- `GET /about`: About page
- `GET /faq`: FAQ page
- `GET /terms`: Terms of service
- `GET /privacy`: Privacy policy

### User Endpoints (Authenticated)
- `GET /profile`: User profile
- `GET /wallet`: Wallet page
- `GET /create`: Create wager page
- `GET /notifications`: Notifications page
- `GET /preferences`: Preferences page
- `GET /leaderboard`: Leaderboard page

### Admin Endpoints
- `GET /admin/login`: Admin login page
- `GET /admin`: Admin dashboard
- `GET /admin/users`: User management
- `GET /admin/wagers`: Wager management
- `GET /admin/transactions`: Transaction management

### API Routes
- `POST /api/payments/initialize`: Initialize Paystack payment
- `GET /api/payments/verify`: Verify Paystack payment
- `POST /api/payments/webhook`: Paystack webhook handler
- `GET /api/admin/users`: Fetch all users (admin only)
- `GET /api/cron/settle-wagers`: Settle expired wagers (cron)
- `GET /api/cron/generate-system-wagers`: Generate system wagers (cron)
- `POST /api/wagers/create-system`: Create system wager (internal)

---

## Security Features

### Authentication & Authorization
- **Row Level Security (RLS)**: All tables protected with RLS policies
- **Admin Separation**: Admins cannot login through regular auth modal
- **Service Role**: Admin operations use Supabase service role key
- **Session Management**: Secure session handling with Supabase SSR

### Data Protection
- **Input Validation**: All user inputs validated
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **XSS Prevention**: React's built-in XSS protection
- **CSRF Protection**: Next.js built-in CSRF protection

### Payment Security
- **Webhook Verification**: Paystack webhook signature verification
- **Server-side Validation**: All payment amounts validated server-side
- **Secure Keys**: API keys stored in environment variables

### Access Control
- **Deadline Validation**: Users cannot join expired wagers
- **Balance Validation**: Users cannot join wagers without sufficient balance
- **Wager Deletion**: Only creators can delete wagers (if no participants)
- **Admin Access**: Admin routes protected with role checks

---

## Deployment & Configuration

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Cron Jobs
CRON_SECRET=your-cron-secret
SYSTEM_WAGER_API_SECRET=your-api-secret

# Optional APIs
ALPHA_VANTAGE_API_KEY=your-key
NEWS_API_KEY=your-key
COINGECKO_API_KEY=your-key
```

### Database Setup
1. Run all SQL scripts in `scripts/` directory in order:
   - `01-setup-schema.sql`
   - `02-update-leaderboard-policies.sql`
   - `03-add-currency-to-wagers.sql`
   - `04-automatic-wager-settlement.sql`
   - `05-add-categories-and-preferences.sql`
   - `06-add-visibility-to-wagers.sql`
   - `12-create-notifications.sql`
   - `13-add-notification-triggers.sql`
   - `14-single-participant-refund.sql`
   - `15-allow-wager-deletion.sql`
   - `16-prevent-bets-after-deadline.sql`
   - `17-add-admin-role.sql`

### Cron Jobs Setup
1. **Settle Wagers**: Every minute
   - URL: `https://your-domain.com/api/cron/settle-wagers`
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`

2. **Generate System Wagers**: Every 6 hours
   - URL: `https://your-domain.com/api/cron/generate-system-wagers`
   - Header: `Authorization: Bearer YOUR_CRON_SECRET`

### Paystack Setup
1. Configure webhook URL: `https://your-domain.com/api/payments/webhook`
2. Select events: `charge.success`, `charge.failed`
3. Add secret key to environment variables

---

## Performance Optimizations

### Caching Strategy
- **Client-side Caching**: In-memory and sessionStorage
- **Stale-while-revalidate**: Background refresh of stale data
- **Service Worker**: Enhanced PWA caching
- **HTTP Headers**: Optimized cache headers for static assets

### Code Optimization
- **Code Splitting**: Automatic code splitting with Next.js
- **Image Optimization**: Next.js Image component
- **Lazy Loading**: Dynamic imports for heavy components
- **Memoization**: React.useMemo and useCallback for expensive operations

---

## Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Future Enhancements (Potential)
- Withdrawal functionality
- Social features (comments, sharing)
- Advanced analytics
- Mobile apps (iOS/Android)
- Multi-currency support
- Referral system
- Tournament/league features

---

## Support & Documentation
- **Technical Docs**: See `docs/` directory
- **API Documentation**: See `docs/API_INTEGRATIONS.md`
- **Cron Setup**: See `docs/CRON_SETUP.md`
- **Payment Setup**: See `PAYSTACK_SETUP.md`

---

**Last Updated**: 2024
**Version**: 0.1.0

