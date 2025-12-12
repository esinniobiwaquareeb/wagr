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
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[nestjsServerFetch] ${method} ${urlString}`, {
      hasToken: !!options?.token,
      requireAuth,
      bodyLength: options?.body ? String(options.body).length : 0,
    });
  }
  
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

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    let data: any;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error(`Failed to parse JSON response from ${urlString}:`, jsonError);
        const text = await response.text();
        console.error('Response text:', text.substring(0, 500));
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Backend returned invalid JSON response',
          },
        };
      }
    } else {
      // Non-JSON response (likely HTML error page or empty)
      const text = await response.text();
      console.error(`Non-JSON response from ${urlString} (status ${response.status}):`, text.substring(0, 500));
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: response.status === 0 || !response.status 
            ? `Cannot connect to backend at ${urlString}. Is the backend running?`
            : `Backend returned non-JSON response (status ${response.status})`,
        },
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || {
          code: 'UNKNOWN_ERROR',
          message: data.message || `API request failed with status ${response.status}`,
        },
      };
    }

    return data;
  } catch (error) {
    console.error(`NestJS API request failed for ${urlString}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Network request failed';
    
    // Check if it's a connection error
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_REFUSED',
          message: `Cannot connect to backend at ${urlString}. Please ensure the backend is running.`,
        },
      };
    }
    
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: errorMessage,
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
} | null> {
  const response = await nestjsServerFetch<{
    user: {
      id: string;
      email: string;
      username: string | null;
      email_verified: boolean;
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

export async function verifyAdminJWTToken(token: string): Promise<{
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
} | null> {
  const response = await nestjsServerFetch<{
    admin: {
      id: string;
      email: string;
      username: string | null;
      full_name: string | null;
      role: string;
      is_active: boolean;
    };
  }>('/admin/me', {
    method: 'GET',
    token,
    requireAuth: true,
  });

  if (!response.success || !response.data?.admin) {
    return null;
  }

  return response.data.admin;
}


