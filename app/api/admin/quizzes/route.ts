import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  successResponseNext,
  appErrorToResponse,
  getPaginationParams,
  getPaginationMeta,
} from '@/lib/api-response';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const supabase = createServiceRoleClient();
    const { page, limit } = getPaginationParams(request);
    const offset = (page - 1) * limit;
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const creatorId = url.searchParams.get('creator_id');

    let query = supabase
      .from('quizzes')
      .select('*, profiles:creator_id(id, username, email, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: quizzes, error, count } = await query;

    if (error) {
      logError(new Error(`Failed to fetch admin quizzes: ${error.message}`), { error });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch quizzes');
    }

    const quizIds = quizzes?.map((quiz) => quiz.id) || [];
    if (quizIds.length > 0) {
      const { data: participantRows, error: participantError } = await supabase
        .from('quiz_participants')
        .select('quiz_id, status')
        .in('quiz_id', quizIds);

      if (!participantError && participantRows) {
        const participantCounts = new Map<string, { total: number; completed: number }>();

        participantRows.forEach((participant) => {
          const current = participantCounts.get(participant.quiz_id) || { total: 0, completed: 0 };
          current.total += 1;
          if (participant.status === 'completed') {
            current.completed += 1;
          }
          participantCounts.set(participant.quiz_id, current);
        });

        quizzes?.forEach((quiz: any) => {
          const counts = participantCounts.get(quiz.id) || { total: 0, completed: 0 };
          quiz.participantCounts = counts;
        });
      }
    }

    const normalized = (quizzes || []).map((quiz: any) => {
      // Handle profiles field from Supabase join - it might be an array or object
      let creator = quiz.profiles;
      if (Array.isArray(creator)) {
        creator = creator[0] || null;
      }
      
      // Explicitly map all fields to ensure nothing is lost
      return {
        id: quiz.id,
        title: quiz.title || '',
        description: quiz.description || null,
        status: quiz.status || 'draft',
        creator_id: quiz.creator_id,
        creator: creator || null,
        entry_fee_per_question: Number(quiz.entry_fee_per_question) || 0,
        total_cost: Number(quiz.total_cost) || 0,
        base_cost: Number(quiz.base_cost) || 0,
        platform_fee: Number(quiz.platform_fee) || 0,
        max_participants: Number(quiz.max_participants) || 0,
        total_questions: Number(quiz.total_questions) || 0,
        created_at: quiz.created_at || null,
        start_date: quiz.start_date || null,
        end_date: quiz.end_date || null,
        participantCounts: quiz.participantCounts || { total: 0, completed: 0 },
        // Include other quiz fields
        platform_fee_percentage: quiz.platform_fee_percentage,
        duration_minutes: quiz.duration_minutes,
        randomize_questions: quiz.randomize_questions,
        randomize_answers: quiz.randomize_answers,
        show_results_immediately: quiz.show_results_immediately,
        updated_at: quiz.updated_at,
        settled_at: quiz.settled_at,
        settlement_method: quiz.settlement_method,
        top_winners_count: quiz.top_winners_count,
      };
    });

    return successResponseNext(
      {
        quizzes: normalized,
        pagination: getPaginationMeta(page, limit, count || 0),
      },
    );
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}


