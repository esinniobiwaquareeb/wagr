/**
 * Client-side API utility
 * Provides typed functions for calling API endpoints
 */

import { ApiResponse } from './api-response';

const API_BASE = '/api';

/**
 * Generic API fetch function with error handling
 * Supports smart caching - GET requests can be cached, mutations always bypass cache
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit & { cache?: RequestCache; forceRefresh?: boolean }
): Promise<ApiResponse<T>> {
  const method = options?.method || 'GET';
  const forceRefresh = options?.forceRefresh || false;
  const isMutation = method !== 'GET';
  
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
  
  const response = await fetch(urlString, {
    ...options,
    credentials: 'include',
    cache: (isMutation || forceRefresh) ? 'no-store' : (options?.cache || 'default'),
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    // If account is suspended or deleted, trigger logout
    if (data.error?.code === 'ACCOUNT_SUSPENDED' || data.error?.code === 'ACCOUNT_DELETED') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-state-changed'));
      }
    }
    throw new Error(data.error?.message || 'API request failed');
  }

  return data;
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
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.category) queryParams.set('category', params.category);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.currency) queryParams.set('currency', params.currency);
    
    const query = queryParams.toString();
    return apiGet<{ wagers: any[]; meta?: any }>(`/wagers${query ? `?${query}` : ''}`);
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
  
  markAllRead: () => apiPost<{ message: string }>('/notifications'),
  
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

