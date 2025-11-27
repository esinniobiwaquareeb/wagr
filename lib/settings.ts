/**
 * Platform Settings Utility
 * Provides helper functions to access platform settings throughout the application
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { KycLimitsConfig } from '@/lib/kyc/types';

export interface PlatformSetting {
  key: string;
  value: any;
  category: string;
  label: string;
  description?: string;
  data_type: 'boolean' | 'number' | 'string' | 'json' | 'array';
  is_public: boolean;
  requires_restart: boolean;
}

/**
 * Get a setting value by key (server-side only)
 * @param key Setting key (e.g., 'payments.enabled')
 * @param defaultValue Default value if setting not found
 * @returns Setting value or default
 */
export async function getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (data?.value !== undefined && data?.value !== null) {
      return data.value as T;
    }
    return defaultValue as T;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue as T;
  }
}

/**
 * Get multiple settings by keys
 * @param keys Array of setting keys
 * @returns Object with key-value pairs
 */
export async function getSettings(keys: string[]): Promise<Record<string, any>> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', keys);

    const settings: Record<string, any> = {};
    data?.forEach(setting => {
      settings[setting.key] = setting.value;
    });

    return settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {};
  }
}

/**
 * Get all settings in a category
 * @param category Category name (e.g., 'payments', 'features')
 * @returns Array of settings
 */
export async function getSettingsByCategory(category: string): Promise<PlatformSetting[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('category', category)
      .order('key', { ascending: true });

    return (data || []) as PlatformSetting[];
  } catch (error) {
    console.error(`Error fetching settings for category ${category}:`, error);
    return [];
  }
}

/**
 * Check if a feature is enabled
 * @param featureKey Feature key (e.g., 'features.wagers_enabled')
 * @returns Boolean indicating if feature is enabled
 */
export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  const value = await getSetting<boolean>(featureKey, false);
  return value === true;
}

/**
 * Get platform fee percentage for wagers
 */
export async function getWagerPlatformFee(): Promise<number> {
  return await getSetting<number>('fees.wager_platform_fee_percentage', 0.05);
}

/**
 * Get platform fee percentage for quizzes
 */
export async function getQuizPlatformFee(): Promise<number> {
  return await getSetting<number>('fees.quiz_platform_fee_percentage', 0.10);
}

/**
 * Get payment limits
 */
export async function getPaymentLimits() {
  const [minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, dailyLimit, monthlyLimit] = await Promise.all([
    getSetting<number>('payments.min_deposit', 100),
    getSetting<number>('payments.max_deposit', 10000000),
    getSetting<number>('payments.min_withdrawal', 100),
    getSetting<number>('payments.max_withdrawal', 1000000),
    getSetting<number>('payments.daily_withdrawal_limit', 500000),
    getSetting<number>('payments.monthly_withdrawal_limit', 5000000),
  ]);

  return {
    minDeposit,
    maxDeposit,
    minWithdrawal,
    maxWithdrawal,
    dailyLimit,
    monthlyLimit,
  };
}

/**
 * Get wager limits
 */
export async function getWagerLimits() {
  const [minAmount, maxAmount, minDeadline, maxDeadline, defaultDeadline, maxTitleLength, maxDescriptionLength, maxSideLength] = await Promise.all([
    getSetting<number>('wagers.min_amount', 100),
    getSetting<number>('wagers.max_amount', 1000000),
    getSetting<number>('wagers.min_deadline_days', 1),
    getSetting<number>('wagers.max_deadline_days', 30),
    getSetting<number>('wagers.default_deadline_days', 7),
    getSetting<number>('wagers.max_title_length', 200),
    getSetting<number>('wagers.max_description_length', 1000),
    getSetting<number>('wagers.max_side_length', 100),
  ]);

  return {
    minAmount,
    maxAmount,
    minDeadline,
    maxDeadline,
    defaultDeadline,
    maxTitleLength,
    maxDescriptionLength,
    maxSideLength,
  };
}

/**
 * Get quiz limits
 */
export async function getQuizLimits() {
  const [minEntryFeePerQuestion, maxEntryFeePerQuestion, minParticipants, maxParticipants, minQuestions, maxQuestions] = await Promise.all([
    getSetting<number>('quizzes.min_entry_fee_per_question', 10),
    getSetting<number>('quizzes.max_entry_fee_per_question', 1000),
    getSetting<number>('quizzes.min_participants', 2),
    getSetting<number>('quizzes.max_participants', 100),
    getSetting<number>('quizzes.min_questions', 1),
    getSetting<number>('quizzes.max_questions', 50),
  ]);

  return {
    minEntryFeePerQuestion,
    maxEntryFeePerQuestion,
    minParticipants,
    maxParticipants,
    minQuestions,
    maxQuestions,
  };
}

/**
 * Get security settings (rate limits, password requirements)
 */
export async function getSecuritySettings() {
  const [minPasswordLength, apiRateLimit, apiRateWindow, authRateLimit, authRateWindow] = await Promise.all([
    getSetting<number>('security.min_password_length', 8),
    getSetting<number>('security.rate_limit_api_requests_limit', 100),
    getSetting<number>('security.rate_limit_api_requests_window', 60),
    getSetting<number>('security.rate_limit_auth_limit', 20),
    getSetting<number>('security.rate_limit_auth_window', 60),
  ]);

  return {
    minPasswordLength,
    apiRateLimit,
    apiRateWindow,
    authRateLimit,
    authRateWindow,
  };
}

/**
 * Get email settings
 */
export async function getEmailSettings() {
  const [fromAddress, provider, resendApiKey, sendgridApiKey] = await Promise.all([
    getSetting<string>('email.from_address', 'noreply@wagr.app'),
    getSetting<string>('email.provider', 'resend'),
    getSetting<string>('email.resend_api_key', ''),
    getSetting<string>('email.sendgrid_api_key', ''),
  ]);

  return {
    fromAddress,
    provider,
    resendApiKey,
    sendgridApiKey,
  };
}

export interface BillsProviderConfig {
  [providerKey: string]: Record<string, any>;
}

export interface BillsSettings {
  billsEnabled: boolean;
  airtimeEnabled: boolean;
  dataEnabled: boolean;
  minAmount: number;
  maxAmount: number;
  dataMinAmount: number;
  dataMaxAmount: number;
  callbackUrl?: string;
  allowedNetworkCodes: string[];
  defaultBonusType?: string | null;
  defaultProvider: string;
  enabledProviders: string[];
  providerConfigs: BillsProviderConfig;
}

/**
 * Get bills (airtime) settings
 */
export async function getBillsSettings(): Promise<BillsSettings> {
  const [
    billsEnabled,
    airtimeEnabled,
    dataEnabled,
    minAmount,
    maxAmount,
    dataMinAmount,
    dataMaxAmount,
    callbackUrl,
    allowedNetworkCodes,
    defaultBonusType,
    defaultProvider,
    enabledProviders,
    nellobyteUserId,
    nellobyteApiKey,
  ] = await Promise.all([
    getSetting<boolean>('features.bills_enabled', true),
    getSetting<boolean>('bills.airtime_enabled', true),
    getSetting<boolean>('bills.data_enabled', true),
    getSetting<number>('bills.airtime_min_amount', 50),
    getSetting<number>('bills.airtime_max_amount', 200000),
    getSetting<number>('bills.data_min_amount', 50),
    getSetting<number>('bills.data_max_amount', 200000),
    getSetting<string>('bills.callback_url', ''),
    getSetting<string[]>('bills.allowed_network_codes', ['01', '02', '03', '04']),
    getSetting<string | null>('bills.default_bonus_type', null),
    getSetting<string>('bills.default_provider', 'nellobyte'),
    getSetting<string[]>('bills.enabled_providers', ['nellobyte']),
    getSetting<string>('bills.nellobyte_user_id', ''),
    getSetting<string>('bills.nellobyte_api_key', ''),
  ]);

  const normalizedEnabledProviders = Array.isArray(enabledProviders)
    ? enabledProviders.map((provider) =>
        typeof provider === 'string' ? provider.toLowerCase() : provider,
      )
    : ['nellobyte'];
  const normalizedDefaultProvider =
    typeof defaultProvider === 'string' ? defaultProvider.toLowerCase() : 'nellobyte';

  return {
    billsEnabled: Boolean(billsEnabled),
    airtimeEnabled: Boolean(airtimeEnabled),
    dataEnabled: Boolean(dataEnabled),
    minAmount,
    maxAmount,
    dataMinAmount,
    dataMaxAmount,
    callbackUrl,
    allowedNetworkCodes: Array.isArray(allowedNetworkCodes) ? allowedNetworkCodes : [],
    defaultBonusType,
    defaultProvider: normalizedDefaultProvider,
    enabledProviders: normalizedEnabledProviders,
    providerConfigs: {
      nellobyte: {
        userId: nellobyteUserId,
        apiKey: nellobyteApiKey,
      },
    },
  };
}

/**
 * Get KYC limit configuration
 */
export async function getKYCLimits(): Promise<KycLimitsConfig> {
  const [
    level1Enabled,
    level2Min,
    level2Max,
    level3Min,
    level3Max,
    dailyCap,
  ] = await Promise.all([
    getSetting<boolean>('kyc.level1_transfer_enabled', false),
    getSetting<number>('kyc.level2_min_transfer', 2000),
    getSetting<number>('kyc.level2_max_transfer', 50000),
    getSetting<number>('kyc.level3_min_transfer', 50001),
    getSetting<number>('kyc.level3_max_transfer', 500000),
    getSetting<number>('kyc.daily_transfer_cap', 500000),
  ]);

  return {
    level1TransferEnabled: Boolean(level1Enabled),
    level2MinTransfer: Number(level2Min ?? 2000),
    level2MaxTransfer: Number(level2Max ?? 50000),
    level3MinTransfer: Number(level3Min ?? 50001),
    level3MaxTransfer: Number(level3Max ?? 500000),
    dailyTransferCap: Number(dailyCap ?? 500000),
  };
}

