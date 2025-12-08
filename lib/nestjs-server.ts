/**
 * NestJS Backend API Client for Server-Side
 * Server-side utilities for calling NestJS backend
 */

const NESTJS_API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';

/**
 * Get JWT token from request headers or cookies
 */
function getAuthTokenFromRequest(request?: Request): string | null {
  if (request) {
    // Try Authorization header first
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
  }
  
  // For server-side, we'll need to get from cookies
  // This will be handled by the Next.js cookies() API
  return null;
}

/**
 * Generic API fetch function for NestJS backend (server-side)
 */
export async function nestjsServerFetch<T>(
  endpoint: string,
  options?: RequestInit & { 
    token?: string | null;
    requireAuth?: boolean;
  }
): Promise<{ success: boolean; data?: T; error?: any }> {
  const method = options?.method || 'GET';
  const requireAuth = options?.requireAuth !== false; // Default to true
  
  // Build URL
  const urlString = `${NESTJS_API_BASE}${endpoint}`;
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  
  // Add auth token if required
  if (requireAuth && options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  
  try {
    const response = await fetch(urlString, {
      ...options,
      headers,
      cache: 'no-store', // Always fetch fresh on server
    });

    const data = await response.json();

    if (!response.ok) {
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
 * Verify JWT token and get user info (server-side)
 */
export async function verifyJWTToken(token: string): Promise<{
  id: string;
  email: string;
  username: string | null;
  email_verified: boolean;
  is_admin: boolean;
} | null> {
  const response = await nestjsServerFetch<{
    user: {
      id: string;
      email: string;
      username: string | null;
      email_verified: boolean;
      is_admin: boolean;
    };
  }>('/auth/me', {
    method: 'GET',
    token,
    requireAuth: true,
  });

  if (!response.success || !response.data?.user) {
    return null;
  }

  return response.data.user;
}

