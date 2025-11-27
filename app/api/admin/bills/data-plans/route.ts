import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { syncNellobyteDataPlans } from '@/lib/bills/data-plans';

async function requireAdmin() {
  const user = await requireAuth();
  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Admin access required');
  }

  return { user, supabase };
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('data_plans')
      .select('*')
      .order('network_code', { ascending: true })
      .order('plan_price', { ascending: true });

    if (error) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch data plans');
    }

    return successResponseNext({ plans: data || [] });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

export async function POST() {
  try {
    await requireAdmin();
    const count = await syncNellobyteDataPlans();
    return successResponseNext({
      message: 'Data plans synced successfully',
      count,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

