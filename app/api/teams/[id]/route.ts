import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * PATCH /api/teams/[id]
 * Update a team
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const { id } = await params;
    const teamId = id;
    const body = await request.json();
    const { name, description, memberIds } = body;

    // Verify ownership
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, creator_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Team not found');
    }

    if (team.creator_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the team creator can update the team');
    }

    // Update team
    const updateData: any = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Team name must be at least 2 characters');
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('teams')
        .update(updateData)
        .eq('id', teamId);

      if (updateError) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update team');
      }
    }

    // Update members if provided
    if (memberIds && Array.isArray(memberIds)) {
      // Remove all existing members
      await supabase.from('team_members').delete().eq('team_id', teamId);

      // Add new members
      const members = memberIds
        .filter((id: string) => id !== user.id)
        .map((memberId: string) => ({
          team_id: teamId,
          user_id: memberId,
        }));

      if (members.length > 0) {
        await supabase.from('team_members').insert(members);
      }
    }

    // Fetch updated team
    const { data: updatedTeam } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        description,
        created_at,
        team_members (
          user_id,
          profiles:user_id (
            id,
            username,
            email,
            avatar_url
          )
        )
      `)
      .eq('id', teamId)
      .single();

    return successResponseNext({ team: updatedTeam });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * DELETE /api/teams/[id]
 * Delete a team
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const { id } = await params;
    const teamId = id;

    // Verify ownership
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, creator_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Team not found');
    }

    if (team.creator_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the team creator can delete the team');
    }

    // Delete team (cascade will delete members)
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (deleteError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to delete team');
    }

    return successResponseNext({ message: 'Team deleted successfully' });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

