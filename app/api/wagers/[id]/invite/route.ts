import { NextRequest } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { sendEmailAsync } from '@/lib/email-queue';
import { logger } from '@/lib/logger';
import { createNotification } from '@/lib/notifications';

/**
 * POST /api/wagers/[id]/invite
 * Invite users to a wager by username or email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    // Use service role client for user lookups to bypass RLS
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const wagerId = validateIDParam(id, 'wager ID');
    const body = await request.json();
    const { invites = [], teamId } = body; // invites: string[] (usernames or emails), teamId?: string

    if ((!invites || !Array.isArray(invites) || invites.length === 0) && !teamId) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'At least one invite or a team is required');
    }

    // Get wager details
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('id, title, description, side_a, side_b, amount, deadline, short_id, creator_id')
      .or(`id.eq.${wagerId},short_id.eq.${wagerId}`)
      .maybeSingle();

    if (wagerError || !wager) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Wager not found');
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user.id)
      .maybeSingle();

    const inviterName = inviterProfile?.username || inviterProfile?.email || 'Someone';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://wagered.app';
    const wagerUrl = `${appUrl}/wager/${wager.short_id || wager.id}`;

    // Process invites
    const results = {
      invited: [] as Array<{ identifier: string; type: 'user' | 'email'; userId?: string }>,
      notFound: [] as string[],
      errors: [] as Array<{ identifier: string; error: string }>,
    };

    // Get team members if teamId is provided
    let teamMembers: string[] = [];
    if (teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', teamId)
        .eq('creator_id', user.id)
        .maybeSingle();

      if (team) {
        const { data: members } = await supabase
          .from('team_members')
          .select('user_id, profiles:user_id(email, username)')
          .eq('team_id', teamId);

        teamMembers = members?.map((m: any) => {
          const profile = m.profiles;
          if (profile?.username) {
            return `@${profile.username}`;
          }
          return profile?.email || '';
        }).filter(Boolean) || [];
      } else {
        throw new AppError(ErrorCode.NOT_FOUND, 'Team not found or you do not have permission to use it');
      }
    }

    // Combine invites and team members, remove duplicates
    const allInvites = [...new Set([...(invites || []), ...teamMembers])].filter(Boolean);
    
    if (allInvites.length === 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'No valid invites to send');
    }

    // Process each invite
    for (const invite of allInvites) {
      const trimmedInvite = invite.trim().toLowerCase();
      
      // Determine if it's an email or username
      // If it starts with @, it's definitely a username
      // Otherwise, check if it's a valid email format (contains @ and has a domain)
      const isUsername = trimmedInvite.startsWith('@');
      const isEmail = !isUsername && trimmedInvite.includes('@') && trimmedInvite.includes('.') && trimmedInvite.split('@').length === 2;

      try {
        if (isEmail) {
          // Check if user exists by email (case-insensitive)
          const { data: profile } = await serviceSupabase
            .from('profiles')
            .select('id, email, username, email_verified')
            .ilike('email', trimmedInvite)
            .maybeSingle();

          if (profile) {
            // User exists - send notification using service role client
            await createNotification({
              user_id: profile.id,
              type: 'wager_invitation',
              title: `${inviterName} invited you to a wager`,
              message: `"${wager.title}" - Join now!`,
              link: wagerUrl,
              metadata: {
                wager_id: wager.id,
                inviter_id: user.id,
                inviter_name: inviterName,
              },
            });

            results.invited.push({
              identifier: trimmedInvite,
              type: 'user',
              userId: profile.id,
            });
          } else {
            // User doesn't exist - send invitation email
            sendEmailAsync({
              to: trimmedInvite,
              type: 'wager-invitation',
              data: {
                recipientName: trimmedInvite.split('@')[0],
                inviterName,
                wagerTitle: wager.title,
                wagerDescription: wager.description || '',
                wagerUrl,
                sideA: wager.side_a,
                sideB: wager.side_b,
                amount: wager.amount,
                deadline: wager.deadline,
              },
            });

            results.invited.push({
              identifier: trimmedInvite,
              type: 'email',
            });
          }
        } else {
          // Username lookup (remove @ if present, case-insensitive)
          const username = trimmedInvite.startsWith('@') ? trimmedInvite.slice(1) : trimmedInvite;
          
          if (!username || username.length === 0) {
            results.notFound.push(trimmedInvite);
            continue;
          }
          
          const { data: profile } = await serviceSupabase
            .from('profiles')
            .select('id, email, username')
            .ilike('username', username)
            .maybeSingle();

          if (profile) {
            // User exists - send notification using service role client
            await createNotification({
              user_id: profile.id,
              type: 'wager_invitation',
              title: `${inviterName} invited you to a wager`,
              message: `"${wager.title}" - Join now!`,
              link: wagerUrl,
              metadata: {
                wager_id: wager.id,
                inviter_id: user.id,
                inviter_name: inviterName,
              },
            });

            results.invited.push({
              identifier: trimmedInvite,
              type: 'user',
              userId: profile.id,
            });
          } else {
            results.notFound.push(trimmedInvite);
          }
        }
      } catch (error) {
        logger.error('Error processing invite:', { invite, error });
        results.errors.push({
          identifier: invite,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Log results for debugging
    console.log('Invite results:', {
      invited: results.invited.length,
      notFound: results.notFound.length,
      errors: results.errors.length,
      invitedDetails: results.invited,
    });

    return successResponseNext({
      message: `Successfully invited ${results.invited.length} ${results.invited.length === 1 ? 'person' : 'people'}`,
      results: {
        invited: results.invited,
        notFound: results.notFound,
        errors: results.errors,
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

