import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * POST /api/quizzes/[id]/settle
 * Manually settle a completed quiz (creator or admin only)
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

    // Get quiz
    const { data: quiz, error: quizError } = await serviceSupabase
      .from('quizzes')
      .select('id, creator_id, status, end_date')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check if user is creator or admin
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin === true;
    const isCreator = quiz.creator_id === user.id;

    if (!isCreator && !isAdmin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the creator or admin can settle this quiz');
    }

    // Check if quiz can be settled
    if (quiz.status === 'settled') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Quiz is already settled');
    }

    const now = new Date();
    const quizEndDate = quiz.end_date ? new Date(quiz.end_date) : null;
    const quizHasEnded = quizEndDate ? quizEndDate <= now : false;

    if (quiz.status === 'draft') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Draft quizzes cannot be settled');
    }

    if (!quizHasEnded && quiz.status !== 'completed' && quiz.status !== 'in_progress') {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Quiz must be completed, in progress, or past its end time to settle'
      );
    }

    // Require at least one completed participant
    const { count: completedCount, error: participantCountError } = await serviceSupabase
      .from('quiz_participants')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('status', 'completed');

    if (participantCountError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to check participants');
    }

    if (!completedCount || completedCount === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'No participants have completed the quiz yet');
    }

    // Ensure quiz is marked as completed before settlement
    if (quiz.status !== 'completed' && quiz.status !== 'settled') {
      await serviceSupabase
        .from('quizzes')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', quizId);
    }

    // Settle quiz using database function
    const { error: settleError } = await serviceSupabase.rpc('settle_quiz', {
      quiz_id_param: quizId,
    });

    if (settleError) {
      logError(new Error(`Failed to settle quiz: ${settleError.message}`), { settleError });
      throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to settle quiz: ${settleError.message}`);
    }

    // Get updated quiz
    const { data: settledQuiz } = await serviceSupabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    // Get settlement details
    const { data: settlement } = await serviceSupabase
      .from('quiz_settlements')
      .select('*')
      .eq('quiz_id', quizId)
      .order('settled_at', { ascending: false })
      .limit(1)
      .single();

    return successResponseNext({
      message: 'Quiz settled successfully',
      quiz: settledQuiz,
      settlement,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

