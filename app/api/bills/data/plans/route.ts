import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, ErrorCode, logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { getBillsSettings } from '@/lib/settings';
import { getStoredDataPlans, syncNellobyteDataPlans } from '@/lib/bills/data-plans';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const networkCode = searchParams.get('networkCode');

    if (!networkCode) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'networkCode is required');
    }

    const billsSettings = await getBillsSettings();
    if (!billsSettings.billsEnabled || !billsSettings.dataEnabled) {
      throw new AppError(ErrorCode.NOT_IMPLEMENTED, 'Data purchases are currently disabled.');
    }

    let plans = await getStoredDataPlans(networkCode);
    if (plans.length === 0) {
      try {
        await syncNellobyteDataPlans();
        plans = await getStoredDataPlans(networkCode);
      } catch (syncError) {
        logError(syncError as Error);
        if (plans.length === 0) {
          throw new AppError(ErrorCode.DATABASE_ERROR, 'Unable to load data plans. Please try again later.');
        }
      }
    }

    return successResponseNext({ plans });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

