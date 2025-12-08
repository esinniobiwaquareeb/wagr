import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/wagers/[id]/activities
 * Get wager activities
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get auth token from cookies for server-side request (optional - activities may be public)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;
    
    // Call NestJS backend to get activities
    const response = await nestjsServerFetch<any>(`/wagers/${id}/activities`, {
      method: 'GET',
      token,
      requireAuth: false, // Public endpoint
    });

    if (!response.success) {
      return successResponseNext({ activities: [] });
    }

    // NestJS returns { success: true, data: { activities } }
    const activities = response.data?.activities || (response.data as any)?.activities || [];

    return successResponseNext({
      activities,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

