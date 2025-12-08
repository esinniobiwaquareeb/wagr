import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/wagers
 * Get all wagers (admin only)
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = new URLSearchParams();
    if (searchParams.get('status')) queryParams.set('status', searchParams.get('status')!);
    if (searchParams.get('search')) queryParams.set('search', searchParams.get('search')!);
    if (searchParams.get('creatorId')) queryParams.set('creatorId', searchParams.get('creatorId')!);
    if (searchParams.get('limit')) queryParams.set('limit', searchParams.get('limit')!);
    if (searchParams.get('offset')) queryParams.set('offset', searchParams.get('offset')!);

    const query = queryParams.toString();

    // Call NestJS backend to get wagers
    const response = await nestjsServerFetch<{ wagers: any[] }>(`/admin/wagers${query ? `?${query}` : ''}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch wagers');
    }

    return successResponseNext({
      wagers: response.data.wagers || [],
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/admin/wagers
 * Create a new wager (admin only - no balance deduction)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to create wager
    const response = await nestjsServerFetch<{ wager: any }>('/admin/wagers', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create wager');
    }

    return successResponseNext({ wager: response.data.wager }, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

