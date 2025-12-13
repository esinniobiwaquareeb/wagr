import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/users
 * Get all users with statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{ users: any[] }>('/admin/users', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch users');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/admin/users
 * Update user account status (suspend/unsuspend)
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const body = await request.json();

    // Call NestJS backend
    const response = await nestjsServerFetch('/admin/users', {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update user status');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

