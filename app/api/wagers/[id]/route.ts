import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/wagers/[id]
 * Get a single wager by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;
    
    // Call NestJS backend to get wager
    const response = await nestjsServerFetch<any>(`/wagers/${id}`, {
      method: 'GET',
      token,
      requireAuth: false, // Public endpoint
    });

    if (!response.success) {
      return successResponseNext({ wager: null });
    }

    // NestJS returns { success: true, data: { wager } }
    const wager = response.data?.wager || (response.data as any)?.wager || null;

    return successResponseNext({
      wager,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/wagers/[id]
 * Delete a wager (only if creator and no participants)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(); // Ensure user is authenticated
    const { id } = await params;

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to delete wager
    const response = await nestjsServerFetch<{ message: string }>(`/wagers/${id}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete wager');
    }

    return successResponseNext({ message: response.data?.message || 'Wager deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/wagers/[id]
 * Update a wager
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const body = await request.json();
    const { id } = await params;

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to update wager
    const response = await nestjsServerFetch<any>(`/wagers/${id}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update wager');
    }

    // NestJS returns { success: true, data: { wager }, message: '...' }
    const nestjsResponse = response as any;
    const wager = nestjsResponse.data?.wager || nestjsResponse.wager;
    const message = nestjsResponse.message || nestjsResponse.data?.message || 'Wager updated successfully';

    return successResponseNext({
      wager,
      message,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

