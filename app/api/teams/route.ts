import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/teams
 * Get all teams for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data: teams, error } = await supabase
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
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch teams');
    }

    return successResponseNext({ teams: teams || [] });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/teams
 * Create a new team
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const body = await request.json();
    const { name, description, memberIds } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Team name must be at least 2 characters');
    }

    if (name.trim().length > 50) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Team name must be less than 50 characters');
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        creator_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (teamError || !team) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to create team');
    }

    // Add members if provided
    if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
      const members = memberIds
        .filter((id: string) => id !== user.id) // Don't add creator as member
        .map((memberId: string) => ({
          team_id: team.id,
          user_id: memberId,
        }));

      if (members.length > 0) {
        await supabase.from('team_members').insert(members);
      }
    }

    // Fetch team with members
    const { data: teamWithMembers } = await supabase
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
      .eq('id', team.id)
      .single();

    return successResponseNext({ team: teamWithMembers }, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

