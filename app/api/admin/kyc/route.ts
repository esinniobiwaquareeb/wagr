import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending';
    const limitParam = Number(searchParams.get('limit')) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT);

    // Build query string
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
    });
    
    if (statusFilter !== 'all') {
      queryParams.set('status', statusFilter);
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{
      submissions: any[];
      summary?: {
        pending: number;
        verified: number;
        rejected: number;
      };
    }>(`/admin/kyc/submissions?${queryParams.toString()}`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch KYC submissions');
    }

    // The backend returns { submissions }, but we need to add summary if not present
    // For now, we'll return what the backend gives us
    return successResponseNext({
      submissions: response.data.submissions || [],
      summary: response.data.summary || {
        pending: 0,
        verified: 0,
        rejected: 0,
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

