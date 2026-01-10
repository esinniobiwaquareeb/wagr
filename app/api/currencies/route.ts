import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/currencies
 * Get all active currencies
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from cookies (optional - currencies are public)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    // Call NestJS backend to get currencies
    const response = await nestjsServerFetch<{ currencies: any[] }>('/currencies', {
      method: 'GET',
      token,
      requireAuth: false, // Currencies are public
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch currencies');
    }

    return successResponseNext({
      currencies: response.data.currencies,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}
