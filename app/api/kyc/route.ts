import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';
import { getKYCLimits } from '@/lib/settings';
import { KYC_LEVELS, getKycLevelConfig } from '@/lib/kyc/levels';
import type { KycSummary, KycSubmissionRecord, KycStatus } from '@/lib/kyc/types';

type KycPayload = Record<string, any>;

async function buildKycSummary(userId: string): Promise<KycSummary> {
  const supabaseAdmin = createServiceRoleClient();
  const limits = await getKYCLimits();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, email_verified, email_verified_at, kyc_level, kyc_level_label, bvn_verified, nin_verified, face_verified, document_verified, kyc_last_submitted_at, kyc_last_reviewed_at',
    )
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to load profile for KYC summary.');
  }

  const { data: submissionsData, error: submissionsError } = await supabaseAdmin
    .from('kyc_submissions')
    .select('id, user_id, level_requested, status, reviewer_id, reviewed_at, rejection_reason, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (submissionsError) {
    throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to load KYC submissions.');
  }

  const submissions = (submissionsData ?? []) as KycSubmissionRecord[];
  const currentLevel = profile.kyc_level ?? 1;
  const currentConfig = getKycLevelConfig(currentLevel);

  const computeStatus = (level: number): KycStatus => {
    if (level <= currentLevel) {
      return 'verified';
    }
    const hasPending = submissions.some(
      (submission) => submission.level_requested === level && submission.status !== 'rejected',
    );
    return hasPending ? 'pending' : 'locked';
  };

  const computeStatusLabel = (status: KycStatus) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending review';
      default:
        return 'Locked';
    }
  };

  const levels = KYC_LEVELS.map((definition) => {
    const status = computeStatus(definition.level);
    const completedAt =
      status === 'verified'
        ? definition.level === 1
          ? profile.email_verified_at
          : profile.kyc_last_reviewed_at
        : undefined;

    const limitsForLevel =
      definition.level === 2
        ? {
            min: limits.level2MinTransfer,
            max: limits.level2MaxTransfer,
          }
        : definition.level === 3
        ? {
            min: limits.level3MinTransfer,
            max: limits.level3MaxTransfer,
          }
        : undefined;

    return {
      level: definition.level,
      label: definition.label,
      description: definition.description,
      status,
      statusLabel: computeStatusLabel(status),
      completedAt: completedAt ?? undefined,
      requirements: definition.requirements,
      limits: limitsForLevel,
    };
  });

  return {
    currentLevel,
    currentLabel: profile.kyc_level_label || currentConfig.label,
    badgeVariant: currentConfig.badgeVariant,
    badgeDescription: currentConfig.description,
    levels,
    submissions: submissions.map(
      ({ id, user_id, level_requested, status, reviewer_id, reviewed_at, rejection_reason, created_at, updated_at }) => ({
        id,
        user_id,
        level_requested,
        status,
        reviewer_id,
        reviewed_at,
        rejection_reason,
        created_at,
        updated_at,
      }),
    ),
    limits,
  };
}

export async function GET() {
  try {
    const user = await requireAuth();
    const summary = await buildKycSummary(user.id);
    return successResponseNext({ summary });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabaseAdmin = createServiceRoleClient();
    const body = await request.json();
    const requestedLevel = Number(body?.level);
    const payload: KycPayload = body?.data || {};

    if (![2, 3].includes(requestedLevel)) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Unsupported KYC level requested.');
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('kyc_level, email_verified, bvn_verified, nin_verified, face_verified, document_verified')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to load your profile.');
    }

    const currentLevel = profile.kyc_level ?? 1;

    if (!profile.email_verified) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Please verify your email before submitting KYC.');
    }

    if (requestedLevel <= currentLevel) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'You are already on this verification level.');
    }

    if (requestedLevel > currentLevel + 1) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Please complete the previous level first.');
    }

    if (requestedLevel === 2) {
      const { fullName, dateOfBirth, idType, idNumber, phoneNumber } = payload;
      if (!fullName || !dateOfBirth || !idType || !idNumber || !phoneNumber) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'All Level 2 fields are required.');
      }
      if (!['bvn', 'nin'].includes(String(idType).toLowerCase())) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Identity type must be BVN or NIN.');
      }
    } else if (requestedLevel === 3) {
      const { documentType, documentNumber, faceReference } = payload;
      if (!documentType || !documentNumber || !faceReference) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'All Level 3 fields are required.');
      }
    }

    const now = new Date().toISOString();
    const levelConfig = getKycLevelConfig(requestedLevel);

    const { error: insertError } = await supabaseAdmin.from('kyc_submissions').insert({
      user_id: user.id,
      level_requested: requestedLevel,
      status: 'verified',
      payload,
      reviewed_at: now,
    });

    if (insertError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to save KYC submission.');
    }

    const profileUpdates: Record<string, any> = {
      kyc_level: requestedLevel,
      kyc_level_label: levelConfig.label,
      kyc_last_submitted_at: now,
      kyc_last_reviewed_at: now,
    };

    if (requestedLevel >= 2) {
      const idType = String(payload.idType || '').toLowerCase();
      profileUpdates.bvn_verified = idType === 'bvn' ? true : profile.bvn_verified;
      profileUpdates.nin_verified = idType === 'nin' ? true : profile.nin_verified;
    }

    if (requestedLevel >= 3) {
      profileUpdates.face_verified = true;
      profileUpdates.document_verified = true;
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id);

    if (profileUpdateError) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to update your verification level.');
    }

    const summary = await buildKycSummary(user.id);

    return successResponseNext({
      message: `KYC Level ${requestedLevel} verified`,
      summary,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

