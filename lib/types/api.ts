/**
 * Type definitions for API responses
 * Ensures type safety across all API endpoints
 */

import { ErrorCode } from '../error-handler';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode | string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * User profile types
 */
export interface UserProfile {
  id: string;
  username: string | null;
  email: string;
  avatar_url: string | null;
  balance: number;
  is_admin: boolean;
  is_suspended: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean;
  created_at: string;
}

/**
 * Category type (returned as relation object from backend)
 */
export interface Category {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  usage_count: number;
}

/**
 * Wager types - matches database structure
 */
export interface Wager {
  id: string;
  short_id: string | null;
  creator_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  side_a: string;
  side_b: string;
  deadline: string | null;
  status: 'OPEN' | 'RESOLVED' | 'SETTLED' | 'REFUNDED';
  winning_side: string | null;
  fee_percentage: number;
  currency: string;
  tags: string[];
  is_system_generated: boolean;
  source_data: Record<string, any> | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  category_id: string | null;
  // Relations (populated by backend)
  category?: Category | null;
  creator?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
  // Computed fields (added by backend)
  participants_count?: number;
  side_a_count?: number;
  side_b_count?: number;
  total_pool?: number;
  entryCounts?: {
    sideA: number;
    sideB: number;
    total: number;
  };
}

/**
 * Wager entry types
 */
export interface WagerEntry {
  id: string;
  wager_id: string;
  user_id: string;
  side: 'A' | 'B';
  amount: number;
  created_at: string;
  user?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
}

/**
 * Transaction types
 */
export interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  reference: string | null;
  description: string | null;
  created_at: string;
}

/**
 * Withdrawal types
 */
export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bank_account: {
    account_number: string;
    bank_code: string;
    account_name: string;
  };
  reference: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

/**
 * Notification types
 */
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, any> | null;
  created_at: string;
}

/**
 * Quiz types
 */
export interface Quiz {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  entry_fee: number;
  prize_pool: number;
  status: 'draft' | 'open' | 'closed' | 'completed';
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

/**
 * Bank types
 */
export interface Bank {
  code: string;
  name: string;
}

/**
 * Settings types
 */
export interface PlatformSetting {
  key: string;
  value: any;
  category: string;
  label: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  is_public: boolean;
  is_secret: boolean;
  updated_at: string;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_winnings: number;
  total_wagers: number;
  win_rate: number;
  rank: number;
}

/**
 * API request types
 */
export interface CreateWagerRequest {
  title: string;
  description?: string;
  amount: number;
  side_a: string;
  side_b: string;
  deadline?: string;
  category?: string;
  is_public?: boolean;
}

export interface JoinWagerRequest {
  side: 'A' | 'B';
  amount: number;
}

export interface DepositRequest {
  amount: number;
  email: string;
}

export interface WithdrawRequest {
  amount: number;
  accountNumber: string;
  bankCode: string;
  accountName: string;
}

export interface TransferRequest {
  recipientUsername: string;
  amount: number;
}

/**
 * API response types
 */
export type WagersResponse = ApiResponse<Wager[]>;
export type WagerResponse = ApiResponse<Wager>;
export type UserProfileResponse = ApiResponse<UserProfile>;
export type TransactionsResponse = ApiResponse<Transaction[]>;
export type WithdrawalsResponse = ApiResponse<Withdrawal[]>;
export type NotificationsResponse = ApiResponse<Notification[]>;
export type BanksResponse = ApiResponse<Bank[]>;
export type LeaderboardResponse = ApiResponse<LeaderboardEntry[]>;
export type SettingsResponse = ApiResponse<PlatformSetting[]>;

