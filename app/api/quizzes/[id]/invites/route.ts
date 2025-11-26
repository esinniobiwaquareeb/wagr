import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/quizzes/[id]/invites
 * Get all invites for a quiz
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

    // Get quiz to verify it exists
    const { data: quiz } = await serviceSupabase
      .from('quizzes')
      .select('id')
      .eq('id', quizId)
      .single();

    if (!quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Get all invitation notifications for this quiz sent by the current user
    const { data: notifications, error: notifError } = await serviceSupabase
      .from('notifications')
      .select(`
        id,
        user_id,
        created_at,
        metadata,
        profiles:user_id (
          id,
          username,
          email,
          avatar_url
        )
      `)
      .eq('type', 'quiz_invitation')
      .eq('metadata->>quiz_id', quiz.id)
      .order('created_at', { ascending: false });

    if (notifError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch invites');
    }

    // Filter to only show invites sent by the current user
    const userInvites = (notifications || []).filter((notif: any) => 
      notif.metadata?.inviter_id === user.id
    );

    // Get all participants to determine status
    const { data: participants } = await serviceSupabase
      .from('quiz_participants')
      .select('user_id, status')
      .eq('quiz_id', quiz.id);

    const participantMap = new Map((participants || []).map((p: any) => [p.user_id, p.status]));

    // Transform notifications to invite format with status
    const inviteMap = new Map<string, any>();
    
    userInvites.forEach((notif: any) => {
      const inviteeId = notif.user_id;
      const participantStatus = participantMap.get(inviteeId);
      
      const existing = inviteMap.get(inviteeId);
      if (!existing || new Date(notif.created_at) > new Date(existing.created_at)) {
        inviteMap.set(inviteeId, {
          id: notif.id,
          invitee_id: inviteeId,
          invitee: notif.profiles ? {
            id: notif.profiles.id,
            username: notif.profiles.username,
            email: notif.profiles.email,
            avatar_url: notif.profiles.avatar_url,
          } : null,
          status: participantStatus || 'invited',
          created_at: notif.created_at,
          inviter_id: notif.metadata?.inviter_id,
          inviter_name: notif.metadata?.inviter_name,
        });
      }
    });

    // Convert map to array and sort by created_at (most recent first)
    const invites = Array.from(inviteMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return successResponseNext({ invites });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

