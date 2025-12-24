import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/admin/wagers/[id]/resolve
 * Set winning side for a wager (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get token from cookies first
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      return appErrorToResponse(new Error('Authentication required. Please log in as admin.'));
    }

    // Verify admin access
    try {
      await requireAdmin();
    } catch (adminError: any) {
      // Provide more specific error message
      const errorMessage = adminError?.message || 'Admin access required';
      if (errorMessage.includes('Forbidden') || errorMessage.includes('Admin access')) {
        return appErrorToResponse(new Error('Admin authentication failed. Please ensure you are logged in as an admin and your session is valid.'));
      }
      throw adminError;
    }

    const { id } = await params;
    const body = await request.json();
    
    // Call NestJS backend to resolve wager
    const response = await nestjsServerFetch<{ message: string }>(`/admin/wagers/${id}/resolve`, {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to resolve wager');
    }

    return successResponseNext({
      message: response.data?.message || 'Winning side set. The wager will be automatically settled by the system when the deadline passes.',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

