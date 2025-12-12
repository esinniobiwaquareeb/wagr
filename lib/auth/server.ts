/**
 * Server-side authentication utilities
 */

import { verifyJWTToken, verifyAdminJWTToken } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  email_verified: boolean;
}

export interface AdminAuthUser {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

/**
 * Get current authenticated user from JWT token
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Get JWT token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('wagr_session')?.value;
    
    if (!token) {
      return null;
    }

    // Verify token with NestJS backend
    const user = await verifyJWTToken(token);
    
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      email_verified: user.email_verified,
    };
  } catch (error) {
    const { logError } = await import('@/lib/error-handler');
    logError(error as Error);
    return null;
  }
}

/**
 * Get current authenticated admin from JWT token
 */
export async function getCurrentAdmin(): Promise<AdminAuthUser | null> {
  try {
    // Get JWT token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('wagr_session')?.value;

  if (!token) {
    return null;
  }

  // Verify token with NestJS backend
  const admin = await verifyAdminJWTToken(token);
  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    email: admin.email,
    username: admin.username || null,
    full_name: admin.full_name || '',
    role: admin.role || '',
    is_active: admin.is_active || true,
  };
  } catch (error) {
    const { logError } = await import('@/lib/error-handler');
    logError(error as Error);
    return null;
  }
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require email verification - throws if email is not verified
 */
export async function requireEmailVerified(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.email_verified) {
    throw new Error('Email verification required');
  }
  return user;
}

/**
 * Check if user is admin
 */
export async function requireAdmin(): Promise<AdminAuthUser> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error('Forbidden: Admin access required');
  }
  return {
    id: admin.id,
    email: admin.email,
    username: admin.username,
    full_name: admin.full_name || null,
    role: admin.role || '',
    is_active: admin.is_active || true,
  };
}

