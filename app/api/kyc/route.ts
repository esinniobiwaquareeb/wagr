import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';
import { cookies } from 'next/headers';
import type { KycSummary } from '@/lib/kyc/types';

export async function GET() {
  try {
    await requireAuth();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to get KYC summary
    const response = await nestjsServerFetch<{ summary: KycSummary }>('/kyc', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch KYC summary');
    }

    return successResponseNext({ summary: response.data.summary });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to submit KYC
    const response = await nestjsServerFetch<{
      message: string;
      summary: KycSummary;
    }>('/kyc', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to submit KYC');
    }

    return successResponseNext({
      message: response.data.message || `KYC Level ${body.level} verified`,
      summary: response.data.summary,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

