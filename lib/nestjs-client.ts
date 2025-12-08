/**
 * NestJS Backend API Client
 * Direct client for calling NestJS backend endpoints
 */

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export interface NestJSResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

/**
 * Get JWT token from cookies or localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Try to get from localStorage first (for client-side)
  const token = localStorage.getItem('auth_token');
  if (token) {
    return token;
  }
  
  // Fallback to cookie (for SSR)
  const cookies = document.cookie.split(';');
  const authCookie = cookies.find(c => c.trim().startsWith('auth_token='));
  if (authCookie) {
    return authCookie.split('=')[1];
  }
  
  return null;
}

/**
 * Set JWT token in localStorage and cookie
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.setItem('auth_token', token);
  // Also set as cookie for SSR
  document.cookie = `auth_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
}

/**
 * Remove JWT token
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem('auth_token');
  document.cookie = 'auth_token=; path=/; max-age=0';
}

/**
 * Generic API fetch function for NestJS backend
 */
async function nestjsFetch<T>(
  endpoint: string,
  options?: RequestInit & { 
    cache?: RequestCache; 
    forceRefresh?: boolean;
    requireAuth?: boolean;
  }
): Promise<NestJSResponse<T>> {
  const method = options?.method || 'GET';
  const forceRefresh = options?.forceRefresh || false;
  const requireAuth = options?.requireAuth !== false; // Default to true
  const isMutation = method !== 'GET';
  
  // Build URL
  let urlString = `${NESTJS_API_BASE}${endpoint}`;
  if (isMutation || forceRefresh) {
    const separator = endpoint.includes('?') ? '&' : '?';
    urlString = `${urlString}${separator}t=${Date.now()}`;
  }
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  
  // Add auth token if required
  if (requireAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  // Cache control for mutations
  if (isMutation || forceRefresh) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }
  
  try {
    const response = await fetch(urlString, {
      ...options,
      headers,
      cache: (isMutation || forceRefresh) ? 'no-store' : (options?.cache || 'default'),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle auth errors
      if (response.status === 401) {
        removeAuthToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-state-changed'));
        }
      }
      
      // Handle account suspension/deletion
      if (data.error?.code === 'ACCOUNT_SUSPENDED' || data.error?.code === 'ACCOUNT_DELETED') {
        removeAuthToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-state-changed'));
        }
      }
      
      return {
        success: false,
        error: data.error || {
          code: 'UNKNOWN_ERROR',
          message: data.message || 'API request failed',
        },
      };
    }

    return data;
  } catch (error) {
    console.error('NestJS API request failed:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

/**
 * GET request helper
 */
export async function nestjsGet<T>(
  endpoint: string, 
  options?: { forceRefresh?: boolean; requireAuth?: boolean }
): Promise<T | null> {
  const response = await nestjsFetch<T>(endpoint, { 
    method: 'GET', 
    forceRefresh: options?.forceRefresh,
    requireAuth: options?.requireAuth,
  });
  
  if (!response.success || !response.data) {
    return null;
  }
  
  return response.data;
}

/**
 * POST request helper
 */
export async function nestjsPost<T>(
  endpoint: string,
  body?: any,
  options?: { requireAuth?: boolean }
): Promise<T | null> {
  const response = await nestjsFetch<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    requireAuth: options?.requireAuth,
  });
  
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Request failed');
  }
  
  return response.data;
}

/**
 * PATCH request helper
 */
export async function nestjsPatch<T>(
  endpoint: string,
  body?: any,
  options?: { requireAuth?: boolean }
): Promise<T | null> {
  const response = await nestjsFetch<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
    requireAuth: options?.requireAuth,
  });
  
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Request failed');
  }
  
  return response.data;
}

/**
 * DELETE request helper
 */
export async function nestjsDelete<T>(
  endpoint: string,
  options?: { requireAuth?: boolean }
): Promise<T | null> {
  const response = await nestjsFetch<T>(endpoint, {
    method: 'DELETE',
    requireAuth: options?.requireAuth,
  });
  
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Request failed');
  }
  
  return response.data;
}

