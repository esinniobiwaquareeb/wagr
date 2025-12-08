import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/settings
 * Get all platform settings (admin only)
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

    // Call NestJS backend to get settings
    const response = await nestjsServerFetch<{ settings: any[]; grouped: any }>('/admin/settings', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch settings');
    }

    return successResponseNext({
      settings: response.data.settings || [],
      grouped: response.data.grouped || {},
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/admin/settings
 * Update platform settings (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to update settings
    const response = await nestjsServerFetch<{
      message: string;
      settings: any[];
      requiresRestart?: boolean;
    }>('/admin/settings', {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to update settings');
    }

    return successResponseNext({
      message: response.data.message || 'Settings updated successfully',
      settings: response.data.settings || [],
      requiresRestart: response.data.requiresRestart || false,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

