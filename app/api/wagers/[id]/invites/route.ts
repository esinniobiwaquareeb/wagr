import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/wagers/[id]/invites
 * Get all invites for a wager using notifications
 * Status is determined by checking if user has joined the wager
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const wagerId = validateIDParam(id, 'wager ID');

    // Get wager to verify it exists
    const { data: wager } = await serviceSupabase
      .from('wagers')
      .select('id')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .maybeSingle();

    if (!wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Get all invitation notifications for this wager sent by the current user
    // Note: We filter by inviter_id in metadata to only show invites sent by current user
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
      .eq('type', 'wager_invitation')
      .eq('metadata->>wager_id', wager.id)
      .order('created_at', { ascending: false });

    if (notifError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch invites');
    }

    // Filter to only show invites sent by the current user
    const userInvites = (notifications || []).filter((notif: any) => 
      notif.metadata?.inviter_id === user.id
    );

    // Get all users who have joined this wager (accepted invites)
    const { data: entries } = await serviceSupabase
      .from('wager_entries')
      .select('user_id')
      .eq('wager_id', wager.id);

    const joinedUserIds = new Set((entries || []).map(e => e.user_id));

    // Transform notifications to invite format with status
    // Group by invitee_id to get unique invites (keep the most recent one if duplicates)
    const inviteMap = new Map<string, any>();
    
    userInvites.forEach((notif: any) => {
      const inviteeId = notif.user_id;
      const hasJoined = joinedUserIds.has(inviteeId);
      
      // If we already have an invite for this user, keep the most recent one
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
          status: hasJoined ? 'accepted' : 'pending',
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

