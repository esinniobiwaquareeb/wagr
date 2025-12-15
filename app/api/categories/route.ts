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
    // Backend returns: { success: true, data: [...] }
    // nestjsServerFetch returns this directly
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
    // Backend controller returns: { success: true, data: [...] }
    // nestjsServerFetch returns the backend response directly: { success: true, data: [...] }
    const response = await nestjsServerFetch<{ success: boolean; data: Category[] }>(`/categories${queryString}`, {
      method: 'GET',
      token: token || undefined,
      requireAuth: false,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch categories');
    }

    // nestjsServerFetch returns the backend response directly, so response.data is the array
    const categories = Array.isArray(response.data) ? response.data : [];

    return successResponseNext({
      categories,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
