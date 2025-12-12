import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/withdrawals/[id]
 * Get withdrawal by ID (admin only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { id } = await params;

    // Call NestJS backend to get withdrawal
    const response = await nestjsServerFetch<{ withdrawal: any }>(`/admin/withdrawals/${id}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch withdrawal');
    }

    return successResponseNext({
      withdrawal: response.data.withdrawal,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/admin/withdrawals/[id]
 * Update withdrawal status (admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { id } = await params;

    // Call NestJS backend to update withdrawal
    const response = await nestjsServerFetch<{ withdrawal: any }>(`/admin/withdrawals/${id}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to update withdrawal');
    }

    return successResponseNext({
      withdrawal: response.data.withdrawal,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
