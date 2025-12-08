import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/settings/[key]
 * Get a specific setting by key (admin only, or public if is_public=true)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAuth();
    const { key } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{ setting: any }>(`/admin/settings/${encodeURIComponent(key)}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch setting');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/admin/settings/[key]
 * Update a specific setting (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAuth();
    const { key } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const body = await request.json();
    const { value, category, label, description, data_type, is_public, requires_restart } = body;

    if (value === undefined) {
      throw new Error('Value is required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{
      setting: any;
      requiresRestart: boolean;
    }>(`/admin/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify({
        value,
        category,
        label,
        description,
        data_type,
        is_public,
        requires_restart,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to update setting');
    }

    return successResponseNext({
      message: 'Setting updated successfully',
      setting: response.data.setting,
      requiresRestart: response.data.requiresRestart,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

