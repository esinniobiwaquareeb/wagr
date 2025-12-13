import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/categories
 * Get all active categories
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from cookies (optional - categories endpoint is public)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    // Get query params
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Call NestJS backend to get categories
    const queryString = includeInactive ? '?includeInactive=true' : '';
    const response = await nestjsServerFetch<{ data: any[] }>(`/categories${queryString}`, {
      method: 'GET',
      token: token || undefined,
      requireAuth: false,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch categories');
    }

    // Backend returns { success: true, data: [...] } where data is an array of categories
    const categories = Array.isArray(response.data) ? response.data : [];

    return successResponseNext({
      categories,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
