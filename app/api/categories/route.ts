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
    // NestJS returns: { success: true, data: [...] }
    // nestjsServerFetch returns: { success: true, data: { success: true, data: [...] } }
    interface Category {
      id: string;
      slug: string;
      label: string;
      icon: string | null;
      description: string | null;
      is_active: boolean;
      is_system: boolean;
      usage_count: number;
    }

    const queryString = includeInactive ? '?includeInactive=true' : '';
    const response = await nestjsServerFetch<{ data: Category[] }>(`/categories${queryString}`, {
      method: 'GET',
      token: token || undefined,
      requireAuth: false,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch categories');
    }

    // nestjsServerFetch returns: { success: true, data: <NestJS response> }
    // NestJS response is: { success: true, data: [...] }
    // So response.data is the NestJS response object, access response.data.data for the array
    const nestjsResponse = response.data as { data?: Category[] };
    const categories = Array.isArray(nestjsResponse.data) ? nestjsResponse.data : [];

    return successResponseNext({
      categories,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
