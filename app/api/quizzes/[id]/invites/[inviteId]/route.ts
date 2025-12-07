import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * DELETE /api/quizzes/[id]/invites/[inviteId]
 * Revoke/delete a quiz invitation
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
    const quizId = validateIDParam(id, 'quiz ID', false); // Only UUID for quizzes
    const validatedInviteId = validateUUIDParam(inviteId, 'invite ID');

    // Get the notification/invite
    const { data: notification, error: notifError } = await serviceSupabase
      .from('notifications')
      .select('id, user_id, metadata')
      .eq('id', validatedInviteId)
      .eq('type', 'quiz_invitation')
      .maybeSingle();

    if (notifError || !notification) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Invitation not found');
    }

    // Verify the invite is for the correct quiz
    if (notification.metadata?.quiz_id !== quizId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invitation does not belong to this quiz');
    }

    // Verify the current user is the inviter (only inviter can revoke)
    if (notification.metadata?.inviter_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'You can only revoke invitations you sent');
    }

    // Also delete the participant record if status is 'invited'
    const { data: participant } = await serviceSupabase
      .from('quiz_participants')
      .select('id, status')
      .eq('quiz_id', quizId)
      .eq('user_id', notification.user_id)
      .maybeSingle();

    if (participant && participant.status === 'invited') {
      await serviceSupabase
        .from('quiz_participants')
        .delete()
        .eq('id', participant.id);
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

