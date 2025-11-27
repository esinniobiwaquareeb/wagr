/**
 * Application-wide constants
 * Centralized configuration values for easy maintenance
 * 
 * NOTE: Many of these values can be overridden by platform settings.
 * Settings are managed in /admin/settings and stored in the platform_settings table.
 * These constants serve as fallback defaults.
 */

// Wager defaults (can be overridden by settings: wagers.default_amount, etc.)
export const DEFAULT_WAGER_AMOUNT = 500;
export const DEFAULT_WAGER_AMOUNT_LARGE = 1000;
export const PLATFORM_FEE_PERCENTAGE = 0.05; // 5% (can be overridden by settings: fees.wager_platform_fee_percentage)

// Deadline defaults (can be overridden by settings: wagers.default_deadline_days, etc.)
export const DEFAULT_DEADLINE_DAYS = 7;
export const MIN_DEADLINE_DAYS = 1;
export const MAX_DEADLINE_DAYS = 30;

// Cache TTL (in milliseconds)
export const CACHE_TTL = {
  WAGERS: 60 * 1000, // 1 minute
  USER_DATA: 5 * 60 * 1000, // 5 minutes
  BANK_LIST: 60 * 60 * 1000, // 1 hour
} as const;

// Rate limits
export const RATE_LIMITS = {
  ACCOUNT_VERIFICATION: { limit: 20, window: 60 }, // 20 per minute
  API_REQUESTS: { limit: 100, window: 60 }, // 100 per minute
} as const;

// UI constants
export const UI = {
  TOAST_DURATION: 5000, // 5 seconds
  DEADLINE_WARNING_MINUTES: 30, // Show orange warning when < 30 min
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_SIDE_LENGTH: 100,
} as const;

// Withdrawal limits (can be overridden by settings: payments.min_withdrawal, etc.)
export const WITHDRAWAL_LIMITS = {
  MIN_AMOUNT: 100, // Default, use settings: payments.min_withdrawal
  MAX_AMOUNT: 1000000, // Default, use settings: payments.max_withdrawal
  DAILY_LIMIT: 500000, // Default, use settings: payments.daily_withdrawal_limit
} as const;

// Categories
export const WAGER_CATEGORIES = [
  { id: "crypto", label: "Cryptocurrency", icon: "₿" },
  { id: "finance", label: "Finance & Stocks", icon: "📈" },
  { id: "politics", label: "Politics", icon: "🏛️" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "technology", label: "Technology", icon: "💻" },
  { id: "religion", label: "Religion", icon: "🙏" },
  { id: "weather", label: "Weather", icon: "🌤️" },
  { id: "other", label: "Other", icon: "🌐" },
] as const;

// Common side options
export const COMMON_SIDES = [
  { label: "Yes / No", value: { sideA: "Yes", sideB: "No" } },
  { label: "Win / Lose", value: { sideA: "Win", sideB: "Lose" } },
  { label: "Over / Under", value: { sideA: "Over", sideB: "Under" } },
  { label: "True / False", value: { sideA: "True", sideB: "False" } },
  { label: "Higher / Lower", value: { sideA: "Higher", sideB: "Lower" } },
  { label: "Custom", value: null },
] as const;

