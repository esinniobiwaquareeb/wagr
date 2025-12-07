import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * DELETE /api/wagers/[id]/invites/[inviteId]
 * Revoke/delete a wager invitation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();
    const { id, inviteId } = await params;
    
    // Sanitize and validate ID inputs
    const { validateIDParam, validateUUIDParam } = await import('@/lib/security/validator');
    const wagerId = validateIDParam(id, 'wager ID');
    const validatedInviteId = validateUUIDParam(inviteId, 'invite ID');

    // Get the notification/invite
    const { data: notification, error: notifError } = await serviceSupabase
      .from('notifications')
      .select('id, user_id, metadata')
      .eq('id', validatedInviteId)
      .eq('type', 'wager_invitation')
      .maybeSingle();

    if (notifError || !notification) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Invitation not found');
    }

    // Verify the invite is for the correct wager
    if (notification.metadata?.wager_id !== wagerId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invitation does not belong to this wager');
    }

    // Verify the current user is the inviter (only inviter can revoke)
    if (notification.metadata?.inviter_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'You can only revoke invitations you sent');
    }

    // Delete the notification (this revokes the invite)
    const { error: deleteError } = await serviceSupabase
      .from('notifications')
      .delete()
      .eq('id', validatedInviteId);

    if (deleteError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to revoke invitation');
    }

    return successResponseNext({
      message: 'Invitation revoked successfully',
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

