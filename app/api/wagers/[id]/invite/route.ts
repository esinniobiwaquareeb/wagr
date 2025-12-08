import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/wagers/[id]/invite
 * Invite users to a wager by username or email
 */
export async function POST(
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

    const body = await request.json();
    const { invites = [], teamId } = body;

    if ((!invites || !Array.isArray(invites) || invites.length === 0) && !teamId) {
      throw new Error('At least one invite or a team is required');
    }

    // Call NestJS backend
    const response = await nestjsServerFetch<{
      message: string;
      results: {
        invited: Array<{ identifier: string; type: 'user' | 'email'; userId?: string }>;
        notFound: string[];
        errors: Array<{ identifier: string; error: string }>;
      };
    }>(`/wagers/${id}/invite`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        invites,
        teamId,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to send invitations');
    }

    return successResponseNext(response.data);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

