/**
 * Client-side API utility
 * Provides typed functions for calling API endpoints
 */

import { ApiResponse } from './api-response';

const API_BASE = '/api';

/**
 * Generic API fetch function with error handling and retry logic
 * Supports smart caching - GET requests can be cached, mutations always bypass cache
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit & { 
    cache?: RequestCache; 
    forceRefresh?: boolean;
    retries?: number;
    retryDelay?: number;
  }
): Promise<ApiResponse<T>> {
  const method = options?.method || 'GET';
  const forceRefresh = options?.forceRefresh || false;
  const isMutation = method !== 'GET';
  const maxRetries = options?.retries ?? (isMutation ? 0 : 2); // Don't retry mutations by default
  const retryDelay = options?.retryDelay ?? 1000; // 1 second default
  
  // Only add timestamp for mutations or when force refresh is requested
  let urlString = `${API_BASE}${endpoint}`;
  if (isMutation || forceRefresh) {
    const separator = endpoint.includes('?') ? '&' : '?';
    urlString = `${urlString}${separator}t=${Date.now()}`;
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  
  // Only bypass cache for mutations or when explicitly requested
  if (isMutation || forceRefresh) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(urlString, {
        ...options,
        credentials: 'include',
        cache: (isMutation || forceRefresh) ? 'no-store' : (options?.cache || 'default'),
        headers,
      });

      // Handle non-JSON responses
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          // If account is suspended or deleted, trigger logout
          if (data.error?.code === 'ACCOUNT_SUSPENDED' || data.error?.code === 'ACCOUNT_DELETED') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('auth-state-changed'));
            }
          }
          throw new Error(data.error?.message || data.message || 'API request failed');
        }
        
        // Retry on server errors (5xx) or rate limits (429)
        if (attempt < maxRetries && (response.status >= 500 || response.status === 429)) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
        
        // If account is suspended or deleted, trigger logout
        if (data.error?.code === 'ACCOUNT_SUSPENDED' || data.error?.code === 'ACCOUNT_DELETED') {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth-state-changed'));
          }
        }
        throw new Error(data.error?.message || data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on network errors for mutations
      if (isMutation && attempt < maxRetries) {
        // Only retry network errors for mutations
        const isNetworkError = lastError.message.includes('fetch') || 
                              lastError.message.includes('network') ||
                              lastError.message.includes('Failed to fetch');
        if (isNetworkError) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
      }
      
      // Retry on network errors for GET requests
      if (!isMutation && attempt < maxRetries) {
        const isNetworkError = lastError.message.includes('fetch') || 
                              lastError.message.includes('network') ||
                              lastError.message.includes('Failed to fetch');
        if (isNetworkError) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
      }
      
      // If we've exhausted retries or it's not a retryable error, throw
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }
  
  // Fallback (should never reach here)
  throw lastError || new Error('API request failed');
}

/**
 * GET request helper
 * @param endpoint - API endpoint
 * @param forceRefresh - If true, bypasses cache even for GET requests
 */
export async function apiGet<T>(endpoint: string, forceRefresh = false): Promise<T> {
  const response = await apiFetch<T>(endpoint, { method: 'GET', forceRefresh });
  return response.data as T;
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  endpoint: string,
  body?: any
): Promise<T> {
  const response = await apiFetch<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.data as T;
}

/**
 * PATCH request helper
 */
export async function apiPatch<T>(
  endpoint: string,
  body?: any
): Promise<T> {
  const response = await apiFetch<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.data as T;
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await apiFetch<T>(endpoint, { method: 'DELETE' });
  return response.data as T;
}

/**
 * Wagers API
 */
export const wagersApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
    currency?: string;
  }, forceRefresh = false) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.category) queryParams.set('category', params.category);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.currency) queryParams.set('currency', params.currency);
    
    const query = queryParams.toString();
    return apiGet<{ wagers: any[]; meta?: any }>(`/wagers${query ? `?${query}` : ''}`, forceRefresh);
  },
  
  get: (id: string) => apiGet<{ wager: any }>(`/wagers/${id}`),
  
  create: (data: {
    title: string;
    description?: string;
    amount: number;
    sideA: string;
    sideB: string;
    deadline: string;
    category?: string;
    currency?: string;
    isPublic?: boolean;
    creatorSide?: 'a' | 'b';
  }) => apiPost<{ wager: any }>('/wagers', data),
  
  join: (id: string, side: 'a' | 'b') => apiPost<{ wager: any; message: string }>(`/wagers/${id}/join`, { side }),
  
  delete: (id: string) => apiDelete<{ message: string }>(`/wagers/${id}`),
  
  getTrending: (limit?: number, forceRefresh = false) => {
    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', limit.toString());
    const query = queryParams.toString();
    // Backend returns { success: true, data: [...], meta: {...} }
    // apiGet extracts response.data, so we get the array directly
    return apiGet<any[]>(`/wagers/trending${query ? `?${query}` : ''}`, forceRefresh);
  },
};

/**
 * Profile API
 */
export const profileApi = {
  get: () => apiGet<{ profile: any }>('/profile'),
  
  update: (data: { username?: string; avatar_url?: string }) =>
    apiPatch<{ profile: any }>('/profile', data),
};

/**
 * KYC API
 */
export const kycApi = {
  get: () => apiGet<{ summary: any }>('/kyc'),
  submit: (data: { level: number; data: Record<string, any> }) =>
    apiPost<{ summary: any; message: string }>('/kyc', data),
};

/**
 * Wallet API
 */
export const walletApi = {
  getBalance: () => apiGet<{ balance: number; currency: string }>('/wallet/balance'),
  
  getTransactions: (params?: {
    page?: number;
    limit?: number;
    type?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.type) queryParams.set('type', params.type);
    
    const query = queryParams.toString();
    return apiGet<{ transactions: any[]; meta?: any }>(`/wallet/transactions${query ? `?${query}` : ''}`);
  },
  
  transfer: (data: {
    username: string;
    amount: number;
    description?: string;
  }) => apiPost<{ message: string; transfer: any }>('/wallet/transfer', data),
};

/**
 * Notifications API
 */
export const notificationsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    read?: 'true' | 'false';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.read) queryParams.set('read', params.read);
    
    const query = queryParams.toString();
    return apiGet<{ notifications: any[]; unreadCount: number; meta?: any }>(`/notifications${query ? `?${query}` : ''}`);
  },
  
  markAllRead: () => apiPost<{ message: string }>('/notifications/mark-all-read'),
  
  markRead: (id: string) => apiPatch<{ message: string }>(`/notifications/${id}`),
  
  delete: (id: string) => apiDelete<{ message: string }>(`/notifications/${id}`),
};

/**
 * Leaderboard API
 */
export const leaderboardApi = {
  get: (params?: {
    page?: number;
    limit?: number;
    type?: 'balance' | 'wins' | 'win_rate' | 'winnings';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.type) queryParams.set('type', params.type);
    
    const query = queryParams.toString();
    return apiGet<{ leaderboard: any[]; meta?: any }>(`/leaderboard${query ? `?${query}` : ''}`);
  },
};

/**
 * Preferences API
 */
export const preferencesApi = {
  get: () => apiGet<{ preferences: any }>('/preferences'),
  
  update: (data: {
    preferred_categories?: string[];
    notification_enabled?: boolean;
    notification_types?: string[];
    push_notifications_enabled?: boolean;
  }) => apiPatch<{ preferences: any }>('/preferences', data),
};

/**
 * Comments API
 */
export const commentsApi = {
  list: (wagerId: string) => apiGet<{ comments: any[] }>(`/wagers/${wagerId}/comments`),
  
  create: (wagerId: string, data: { content: string; parent_id?: string }) =>
    apiPost<{ comment: any }>(`/wagers/${wagerId}/comments`, data),
  
  update: (wagerId: string, commentId: string, data: { content: string }) =>
    apiPatch<{ comment: any }>(`/wagers/${wagerId}/comments/${commentId}`, data),
  
  delete: (wagerId: string, commentId: string) =>
    apiDelete<{ message: string }>(`/wagers/${wagerId}/comments/${commentId}`),
};

/**
 * Categories API
 */
export const categoriesApi = {
  list: (includeInactive = false) => {
    const query = includeInactive ? '?includeInactive=true' : '';
    return apiGet<{ categories: Array<{
      id: string;
      slug: string;
      label: string;
      icon: string | null;
      description: string | null;
      is_active: boolean;
      is_system: boolean;
      usage_count: number;
    }> }>(`/categories${query}`);
  },
};

/**
 * Referrals API
 */
export const referralsApi = {
  getCode: () => apiGet<{ referral_code: string }>('/referrals/code'),
  
  use: (referralCode: string) => apiPost<{ data: { referral: any }; message: string }>('/referrals/use', { referral_code: referralCode }),
  
  getStats: () => apiGet<any>('/referrals/stats'),
  
  getLeaderboard: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return apiGet<{ leaderboard: any[] }>(`/referrals/leaderboard${query}`);
  },
};

/**
 * Social API
 */
export const socialApi = {
  follow: (userId: string) => apiPost<{ data: { follow: any }; message: string }>(`/social/follow/${userId}`),
  
  unfollow: (userId: string) => apiDelete<{ message: string }>(`/social/follow/${userId}`),
  
  isFollowing: (userId: string) => apiGet<{ data: { is_following: boolean } }>(`/social/follow/${userId}`),
  
  getFollowers: (userId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString();
    return apiGet<{ data: { followers: any[]; total: number } }>(`/social/followers/${userId}${query ? `?${query}` : ''}`);
  },
  
  getFollowing: (userId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString();
    return apiGet<{ data: { following: any[]; total: number } }>(`/social/following/${userId}${query ? `?${query}` : ''}`);
  },
  
  getProfile: (userId: string) => apiGet<{ data: { profile: any } }>(`/social/profile/${userId}`),
  
  getActivityFeed: (filter?: 'all' | 'following', limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (filter) params.set('filter', filter);
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString();
    return apiGet<{ data: { activities: any[]; total: number } }>(`/social/activity-feed${query ? `?${query}` : ''}`);
  },
};

/**
 * Gamification API
 */
export const gamificationApi = {
  getStats: () => apiGet<any>('/gamification/stats'),
  
  getChallenges: () => apiGet<{ challenges: any[] }>('/gamification/challenges'),
  
  claimReward: (challengeId: string) => apiPost<{ message: string }>(`/gamification/challenges/${challengeId}/claim`),
  
  claimStreakReward: (streakType: 'login' | 'activity', milestoneDays: number) => 
    apiPost<{ message: string }>(`/gamification/streaks/${streakType}/claim`, { milestone_days: milestoneDays }),
};

/**
 * Subscriptions API
 */
export const subscriptionsApi = {
  getStatus: () => apiGet<{ data: { is_premium: boolean; subscription: any } }>('/subscriptions/status'),
  
  getBenefits: () => apiGet<{ data: any }>('/subscriptions/benefits'),
  
  initializePayment: (provider?: 'paystack' | 'stripe') => apiPost<{ authorization_url?: string; checkout_url?: string; reference: string; provider: string; amount: number }>('/subscriptions/initialize-payment', { provider: provider || 'paystack' }),
  
  subscribe: (paymentReference?: string) => apiPost<{ data: { subscription: any }; message: string }>('/subscriptions/subscribe', { payment_reference: paymentReference }),
  
  cancel: () => apiDelete<{ message: string }>('/subscriptions/cancel'),
};

/**
 * Admin Email Templates API
 */
export const adminEmailTemplatesApi = {
  getAll: () => apiGet<{ templates: any[] }>('/admin/email-templates'),
  
  getById: (id: string) => apiGet<{ template: any }>(`/admin/email-templates/${id}`),
  
  getByType: (type: string) => apiGet<{ template: any }>(`/admin/email-templates/type/${type}`),
  
  create: (data: any) => apiPost<{ template: any; message: string }>('/admin/email-templates', data),
  
  update: (id: string, data: any) => apiPatch<{ template: any; message: string }>(`/admin/email-templates/${id}`, data),
  
  delete: (id: string) => apiDelete<{ success: boolean; message: string }>(`/admin/email-templates/${id}`),
  
  test: (email: string, templateId: string, customData?: Record<string, any>) => apiPost<{ success: boolean; message: string }>('/admin/email-templates/test', { email, templateId, customData }),
};

