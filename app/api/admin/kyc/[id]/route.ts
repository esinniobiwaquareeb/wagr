import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';
import { getKycLevelConfig } from '@/lib/kyc/levels';

function normalizeSubmission(entry: any) {
  const user = entry.profiles || null;
  const { profiles, ...rest } = entry;
  return {
    ...rest,
    user,
  };
}

async function fetchSubmissionWithUser(supabaseAdmin: ReturnType<typeof createServiceRoleClient>, id: string) {
  const { data, error } = await supabaseAdmin
    .from('kyc_submissions')
    .select(
      `
      id,
      user_id,
      level_requested,
      status,
      reviewer_id,
      reviewed_at,
      rejection_reason,
      payload,
      created_at,
      updated_at,
      profiles:profiles!inner(
        id,
        username,
        email,
        avatar_url,
        kyc_level,
        kyc_level_label,
        bvn_verified,
        nin_verified,
        face_verified,
        document_verified
      )
    `,
    )
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'KYC submission not found');
  }

  return data;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();
    const { id } = await context.params;
    
    // Sanitize and validate ID input
    const { validateUUIDParam } = await import('@/lib/security/validator');
    const submissionId = validateUUIDParam(id, 'submission ID');
    const body = await request.json();
    const { status, reason } = body;

    if (!['verified', 'rejected'].includes(status)) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Unsupported status update.');
    }

    if (status === 'rejected' && (!reason || typeof reason !== 'string' || !reason.trim())) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Rejection reason is required.');
    }

    const submission = await fetchSubmissionWithUser(supabaseAdmin, submissionId);

    if (submission.status === status) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Submission already marked as ${status}.`);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('kyc_submissions')
      .update({
        status,
        reviewer_id: admin.id,
        reviewed_at: now,
        rejection_reason: status === 'rejected' ? reason : null,
      })
      .eq('id', submissionId);

    if (updateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update submission status.');
    }

    if (status === 'verified') {
      const level = submission.level_requested;
      const config = getKycLevelConfig(level);
      const payload = submission.payload || {};

      const profileUpdates: Record<string, any> = {
        kyc_level: level,
        kyc_level_label: config.label,
        kyc_last_reviewed_at: now,
      };

      if (level >= 2) {
        const idType = String(payload.idType || payload.identityType || '').toLowerCase();
        if (idType === 'bvn') {
          profileUpdates.bvn_verified = true;
        }
        if (idType === 'nin') {
          profileUpdates.nin_verified = true;
        }
      }

      if (level >= 3) {
        profileUpdates.face_verified = true;
        profileUpdates.document_verified = true;
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', submission.user_id);

      if (profileError) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update user profile.');
      }
    }

    const refreshed = await fetchSubmissionWithUser(supabaseAdmin, submissionId);

    return successResponseNext({
      message: `Submission marked as ${status}.`,
      submission: normalizeSubmission(refreshed),
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

