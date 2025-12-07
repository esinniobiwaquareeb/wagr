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
 * POST /api/quizzes/[id]/invite
 * Invite users to a quiz by username or email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { id } = await params;
    
    // Sanitize and validate ID input
    const { validateIDParam } = await import('@/lib/security/validator');
    const quizId = validateIDParam(id, 'quiz ID', false); // Only UUID for quizzes
    const body = await request.json();
    const { invites = [], teamId } = body;

    if ((!invites || !Array.isArray(invites) || invites.length === 0) && !teamId) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'At least one invite or a team is required');
    }

    // Get quiz details
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, title, description, creator_id, max_participants, status, entry_fee_per_question, total_questions, end_date')
      .eq('id', quizId)
      .maybeSingle();

    if (quizError || !quiz) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Quiz not found');
    }

    // Check ownership
    if (quiz.creator_id !== user.id) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only the creator can invite participants');
    }

    // Check if quiz is open for invitations
    if (!['draft', 'open'].includes(quiz.status)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Can only invite participants to quizzes in draft or open status');
    }

    // Get current participant count
    const { count: currentCount } = await serviceSupabase
      .from('quiz_participants')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId);

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user.id)
      .maybeSingle();

    const inviterName = inviterProfile?.username || inviterProfile?.email || 'Someone';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://wagered.app';
    const quizUrl = `${appUrl}/quiz/${quiz.id}`;

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

    // Check if adding these invites would exceed max participants
    const newInviteCount = allInvites.length;
    if ((currentCount || 0) + newInviteCount > quiz.max_participants) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Adding ${newInviteCount} participants would exceed the maximum of ${quiz.max_participants} participants`
      );
    }

    // Process each invite
    for (const invite of allInvites) {
      const trimmedInvite = invite.trim().toLowerCase();
      
      try {
        // Check if it's an email (contains @ and has domain)
        const isEmail = trimmedInvite.includes('@') && 
                       trimmedInvite.split('@').length === 2 && 
                       trimmedInvite.split('@')[1].includes('.');

        if (isEmail) {
          // Email lookup
          const { data: profile } = await serviceSupabase
            .from('profiles')
            .select('id, email, username')
            .ilike('email', trimmedInvite)
            .maybeSingle();

          if (profile) {
            // Prevent creator from inviting themselves
            if (profile.id === quiz.creator_id) {
              results.errors.push({
                identifier: trimmedInvite,
                error: 'You cannot invite yourself to your own quiz',
              });
              continue;
            }

            // Check if already invited
            const { data: existing } = await serviceSupabase
              .from('quiz_participants')
              .select('id')
              .eq('quiz_id', quizId)
              .eq('user_id', profile.id)
              .maybeSingle();

            if (existing) {
              results.errors.push({
                identifier: trimmedInvite,
                error: 'Already invited',
              });
              continue;
            }

            // Create participant record
            const { error: participantError } = await serviceSupabase
              .from('quiz_participants')
              .insert({
                quiz_id: quizId,
                user_id: profile.id,
                status: 'invited',
              });

            if (participantError) {
              results.errors.push({
                identifier: trimmedInvite,
                error: participantError.message,
              });
              continue;
            }

            // Send notification
            await createNotification({
              user_id: profile.id,
              type: 'quiz_invitation',
              title: `${inviterName} invited you to a quiz`,
              message: `"${quiz.title}" - Join now!`,
              link: quizUrl,
              metadata: {
                quiz_id: quiz.id,
                inviter_id: user.id,
                inviter_name: inviterName,
              },
            });

            // Send email notification
            if (profile.email) {
              try {
                await sendEmailAsync({
                  to: profile.email,
                  type: 'quiz-invitation',
                  data: {
                    recipientName: profile.username || profile.email.split('@')[0],
                    inviterName: inviterName,
                    quizTitle: quiz.title,
                    quizDescription: quiz.description || '',
                    quizUrl: quizUrl,
                    entryFeePerQuestion: quiz.entry_fee_per_question,
                    totalQuestions: quiz.total_questions,
                    maxParticipants: quiz.max_participants,
                    endDate: quiz.end_date || undefined,
                  },
                  subject: `Quiz Invitation: ${quiz.title}`,
                });
              } catch (emailError) {
                logger.error('Failed to send quiz invitation email', { emailError, invite: trimmedInvite });
              }
            }

            results.invited.push({
              identifier: trimmedInvite,
              type: 'email',
              userId: profile.id,
            });
          } else {
            // User doesn't exist - send invitation email anyway
            try {
              await sendEmailAsync({
                to: trimmedInvite,
                type: 'quiz-invitation',
                data: {
                  recipientName: trimmedInvite.split('@')[0],
                  inviterName: inviterName,
                  quizTitle: quiz.title,
                  quizDescription: quiz.description || '',
                  quizUrl: quizUrl,
                  entryFeePerQuestion: quiz.entry_fee_per_question,
                  totalQuestions: quiz.total_questions,
                  maxParticipants: quiz.max_participants,
                  endDate: quiz.end_date || undefined,
                },
                subject: `Quiz Invitation: ${quiz.title}`,
              });

              results.invited.push({
                identifier: trimmedInvite,
                type: 'email',
              });
            } catch (emailError) {
              logger.error('Failed to send quiz invitation email to non-user', { emailError, invite: trimmedInvite });
              results.errors.push({
                identifier: trimmedInvite,
                error: 'Failed to send invitation email',
              });
            }
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
            // Prevent creator from inviting themselves
            if (profile.id === quiz.creator_id) {
              results.errors.push({
                identifier: trimmedInvite,
                error: 'You cannot invite yourself to your own quiz',
              });
              continue;
            }

            // Check if already invited
            const { data: existing } = await serviceSupabase
              .from('quiz_participants')
              .select('id')
              .eq('quiz_id', quizId)
              .eq('user_id', profile.id)
              .maybeSingle();

            if (existing) {
              results.errors.push({
                identifier: trimmedInvite,
                error: 'Already invited',
              });
              continue;
            }

            // Create participant record
            const { error: participantError } = await serviceSupabase
              .from('quiz_participants')
              .insert({
                quiz_id: quizId,
                user_id: profile.id,
                status: 'invited',
              });

            if (participantError) {
              results.errors.push({
                identifier: trimmedInvite,
                error: participantError.message,
              });
              continue;
            }

            // Send notification
            await createNotification({
              user_id: profile.id,
              type: 'quiz_invitation',
              title: `${inviterName} invited you to a quiz`,
              message: `"${quiz.title}" - Join now!`,
              link: quizUrl,
              metadata: {
                quiz_id: quiz.id,
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
        logger.error('Error processing quiz invite:', { invite, error });
        results.errors.push({
          identifier: invite,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return successResponseNext({
      message: `Successfully invited ${results.invited.length} ${results.invited.length === 1 ? 'person' : 'people'}`,
      results: {
        invited: results.invited.length,
        notFound: results.notFound.length,
        errors: results.errors.length,
        details: {
          invited: results.invited,
          notFound: results.notFound,
          errors: results.errors,
        },
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

