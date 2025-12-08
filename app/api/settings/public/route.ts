import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

/**
 * GET /api/settings/public
 * Get all public platform settings (accessible to all users)
 */
export async function GET(request: NextRequest) {
  try {
    // Call NestJS backend to get public settings (no auth required)
    const response = await nestjsServerFetch<{ settings: Record<string, any> }>('/admin/settings/public', {
      method: 'GET',
      requireAuth: false, // Public endpoint, no authentication required
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch public settings');
    }

    return successResponseNext({ settings: response.data.settings || {} });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

