/**
 * Client-side API utility
 * Provides typed functions for calling API endpoints
 */

import { ApiResponse } from './api-response';

const API_BASE = '/api';

/**
 * Generic API fetch function with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit & { cache?: RequestCache }
): Promise<ApiResponse<T>> {
  // Always bypass cache for all endpoints to ensure fresh data
  const separator = endpoint.includes('?') ? '&' : '?';
  const urlString = `${API_BASE}${endpoint}${separator}t=${Date.now()}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...(options?.headers as Record<string, string>),
  };
  
  const response = await fetch(urlString, {
    ...options,
    credentials: 'include', // Include cookies for session
    cache: 'no-store', // Always bypass cache
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'API request failed');
  }

  return data;
}

/**
 * GET request helper
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await apiFetch<T>(endpoint, { method: 'GET' });
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
    type?: 'balance' | 'winnings';
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

