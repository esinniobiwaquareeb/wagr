import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdminAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminAuth();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('wagr_session')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await nestjsServerFetch<{ admin: any }>(`/admin/admins/${params.id}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch admin');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminAuth();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('wagr_session')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const body = await request.json();

    const response = await nestjsServerFetch<{ admin: any }>(`/admin/admins/${params.id}`, {
      method: 'PATCH',
      token,
      requireAuth: true,
      body,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to update admin');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminAuth();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('wagr_session')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await nestjsServerFetch<{ success: boolean; message: string }>(`/admin/admins/${params.id}`, {
      method: 'DELETE',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to delete admin');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

