import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdminAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('wagr_session')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const body = await request.json();
    const { code, isBackupCode } = body;

    if (!code) {
      throw new Error('Verification code is required');
    }

    const response = await nestjsServerFetch<{
      success: boolean;
      message: string;
    }>('/admin/2fa/verify', {
      method: 'POST',
      token,
      requireAuth: true,
      body: { code, isBackupCode: isBackupCode || false },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to verify 2FA');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

