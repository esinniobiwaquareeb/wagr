import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/quizzes/[id]/responses
 * Get quiz responses for the current user (participant)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    const quizId = id;

    // Get quiz
    const { data: quiz, error: quizError } = await serviceSupabase
      .from('quizzes')
      .select('id, title, status, end_date, settled_at')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check if user is a participant
    const { data: participant, error: participantError } = await serviceSupabase
      .from('quiz_participants')
      .select('id, status, completed_at')
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      throw new AppError(ErrorCode.FORBIDDEN, 'You are not a participant in this quiz');
    }

    // Show results immediately after participant completes the quiz
    // Since correct answers are already known, there's no need to wait for settlement
    if (participant.status !== 'completed') {
      throw new AppError(ErrorCode.FORBIDDEN, 'You must complete the quiz to view results');
    }

    // Get all responses with questions and answers
    const { data: responses, error: responsesError } = await serviceSupabase
      .from('quiz_responses')
      .select(`
        *,
        quiz_questions (
          id,
          question_text,
          question_type,
          points,
          order_index,
          quiz_answers (
            id,
            answer_text,
            is_correct,
            order_index
          )
        )
      `)
      .eq('participant_id', participant.id)
      .order('quiz_questions(order_index)', { ascending: true });

    if (responsesError) {
      logError(new Error(`Failed to fetch responses: ${responsesError.message}`), { responsesError });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch responses');
    }

    // Get participant details with score
    const { data: participantDetails } = await serviceSupabase
      .from('quiz_participants')
      .select('*, profiles:user_id(username, avatar_url)')
      .eq('id', participant.id)
      .single();

    // Get all participants for leaderboard (only if quiz is settled or completed)
    let allParticipants = [];
    if (['completed', 'settled'].includes(quiz.status)) {
      const { data: participants } = await serviceSupabase
        .from('quiz_participants')
        .select('*, profiles:user_id(username, avatar_url)')
        .eq('quiz_id', quizId)
        .eq('status', 'completed')
        .order('score', { ascending: false })
        .order('completed_at', { ascending: true });

      allParticipants = participants || [];
    }

    return successResponseNext({
      quiz,
      participant: participantDetails,
      responses: responses || [],
      participants: allParticipants,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

