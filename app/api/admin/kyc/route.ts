import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function normalizeSubmission(entry: any) {
  const user = entry.profiles || null;
  const { profiles, ...rest } = entry;
  return {
    ...rest,
    user,
  };
}

function isMissingKycSchema(error: any): boolean {
  const errorCode = error?.code;
  const message = (error?.message || '').toLowerCase();
  return (
    errorCode === '42P01' ||
    errorCode === '42703' ||
    (message.includes('kyc_submissions') && message.includes('does not exist')) ||
    (message.includes('kyc_level') && message.includes('does not exist'))
  );
}

async function fetchStatusCount(supabase: ReturnType<typeof createServiceRoleClient>, status: string) {
  const { count, error } = await supabase
    .from('kyc_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', status);

  if (error) {
    if (isMissingKycSchema(error)) {
      return 0;
    }
    logError(new Error(`Failed to get ${status} count: ${error.message}`));
    return 0;
  }

  return count ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending';
    const limitParam = Number(searchParams.get('limit')) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT);

    let query = supabaseAdmin
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
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingKycSchema(error)) {
        return successResponseNext({
          submissions: [],
          summary: {
            pending: 0,
            verified: 0,
            rejected: 0,
          },
          warning: 'KYC schema not found. Please run the latest migrations.',
        });
      }
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch KYC submissions');
    }

    const submissions = (data ?? []).map(normalizeSubmission);

    const [pending, verified, rejected] = await Promise.all([
      fetchStatusCount(supabaseAdmin, 'pending'),
      fetchStatusCount(supabaseAdmin, 'verified'),
      fetchStatusCount(supabaseAdmin, 'rejected'),
    ]);

    return successResponseNext({
      submissions,
      summary: {
        pending,
        verified,
        rejected,
      },
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

