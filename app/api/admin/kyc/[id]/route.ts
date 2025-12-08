import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * PATCH /api/admin/kyc/[id]
 * Approve or reject a KYC submission
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const body = await request.json();
    const { status, reason } = body;

    // Map frontend status to NestJS endpoints
    if (status === 'verified') {
      // Approve submission
      const response = await nestjsServerFetch<{ submission: any }>(
        `/admin/kyc/submissions/${id}/approve`,
        {
          method: 'POST',
          token,
          requireAuth: true,
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to approve KYC submission');
      }

      return successResponseNext({
        message: 'Submission marked as verified.',
        submission: response.data.submission,
      });
    } else if (status === 'rejected') {
      // Reject submission
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw new Error('Rejection reason is required.');
      }

      const response = await nestjsServerFetch<{ submission: any }>(
        `/admin/kyc/submissions/${id}/reject`,
        {
          method: 'POST',
          token,
          requireAuth: true,
          body: { reason },
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to reject KYC submission');
      }

      return successResponseNext({
        message: 'Submission marked as rejected.',
        submission: response.data.submission,
      });
    } else {
      throw new Error('Unsupported status update. Use "verified" or "rejected".');
    }
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

