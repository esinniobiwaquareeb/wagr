import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  byContext: Record<string, number>;
  oldestLog: string | null;
  newestLog: string | null;
}

/**
 * GET /api/admin/logs/stats
 * Get log statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Call NestJS backend to get log stats (no auth required)
    const response = await nestjsServerFetch<{ stats: LogStats }>('/admin/logs/stats', {
      method: 'GET',
      requireAuth: false,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch log statistics');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

