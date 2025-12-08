import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/wagers/[id]/invites
 * Get all invites for a wager
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{
      invites: Array<{
        id: string;
        invitee_id: string;
        invitee: {
          id: string;
          username: string | null;
          email: string;
          avatar_url: string | null;
        } | null;
        status: string;
        created_at: string;
        inviter_id: string;
        inviter_name: string;
      }>;
    }>(`/wagers/${id}/invites`, {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch invites');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

