import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose';
  context?: string;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}

interface LogsResponse {
  logs: LogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    byLevel: Record<string, number>;
    byContext: Record<string, number>;
    oldestLog: string | null;
    newestLog: string | null;
  };
}

/**
 * GET /api/admin/logs
 * Get application logs (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = new URLSearchParams();
    if (searchParams.get('level')) queryParams.set('level', searchParams.get('level')!);
    if (searchParams.get('context')) queryParams.set('context', searchParams.get('context')!);
    if (searchParams.get('search')) queryParams.set('search', searchParams.get('search')!);
    if (searchParams.get('startDate')) queryParams.set('startDate', searchParams.get('startDate')!);
    if (searchParams.get('endDate')) queryParams.set('endDate', searchParams.get('endDate')!);
    if (searchParams.get('limit')) queryParams.set('limit', searchParams.get('limit')!);
    if (searchParams.get('offset')) queryParams.set('offset', searchParams.get('offset')!);

    const query = queryParams.toString();

    // Call NestJS backend to get logs (no auth required)
    const response = await nestjsServerFetch<LogsResponse>(`/admin/logs${query ? `?${query}` : ''}`, {
      method: 'GET',
      requireAuth: false,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch logs');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/admin/logs
 * Clear all logs (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Call NestJS backend to clear logs (no auth required)
    const response = await nestjsServerFetch<{ message: string }>('/admin/logs', {
      method: 'DELETE',
      requireAuth: false,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to clear logs');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

