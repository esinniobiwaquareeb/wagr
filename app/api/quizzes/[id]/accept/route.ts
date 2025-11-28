import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * POST /api/quizzes/[id]/accept
 * Accept a quiz invitation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const quizId = validateIDParam(id, 'quiz ID', false); // Only UUID for quizzes

    // Check if user is invited
    const { data: participant, error: participantError } = await serviceSupabase
      .from('quiz_participants')
      .select('id, status, quiz_id')
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      throw new AppError(ErrorCode.NOT_FOUND, 'You are not invited to this quiz');
    }

    if (participant.status !== 'invited') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Invitation already ${participant.status}`);
    }

    // Get quiz to check status
    const { data: quiz } = await serviceSupabase
      .from('quizzes')
      .select('id, status, max_participants')
      .eq('id', quizId)
      .single();

    if (!quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check if quiz is still open
    if (!['draft', 'open'].includes(quiz.status)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Quiz is no longer accepting participants');
    }

    // Check if max participants reached
    const { count: currentParticipants } = await serviceSupabase
      .from('quiz_participants')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .in('status', ['accepted', 'started', 'completed']);

    if ((currentParticipants || 0) >= quiz.max_participants) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Quiz has reached maximum participants');
    }

    // Update participant status to accepted
    const { error: updateError } = await serviceSupabase
      .from('quiz_participants')
      .update({ status: 'accepted' })
      .eq('id', participant.id);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to accept invitation');
    }

    // Mark notification as read if exists
    await serviceSupabase
      .from('notifications')
      .update({ read: true })
      .eq('type', 'quiz_invitation')
      .eq('user_id', user.id)
      .eq('metadata->>quiz_id', quizId);

    return successResponseNext({
      message: 'Invitation accepted successfully',
      participant: {
        id: participant.id,
        status: 'accepted',
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

