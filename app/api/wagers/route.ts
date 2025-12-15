import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams } from '@/lib/api-response';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * GET /api/wagers
 * List wagers with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { page, limit } = getPaginationParams(request);
    const url = new URL(request.url);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set('page', page.toString());
    queryParams.set('limit', limit.toString());
    
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const currency = url.searchParams.get('currency');
    
    if (status) queryParams.set('status', status);
    if (category) queryParams.set('category', category);
    if (search) queryParams.set('search', search);
    if (currency) queryParams.set('currency', currency);

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;
    
    // Call NestJS backend using server-side fetch
    // Backend controller returns: { success: true, data: [...], meta: {...} }
    // TransformInterceptor passes it through as-is (since it has 'success' field)
    // nestjsServerFetch returns: { success: true, data: [...], meta: {...} }
    interface NestJSWagersResponse {
      data: unknown[];
      meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }

    const response = await nestjsServerFetch<{ success: boolean; data: unknown[]; meta?: NestJSWagersResponse['meta'] }>(`/wagers?${queryParams.toString()}`, {
      method: 'GET',
      token,
      requireAuth: false, // Public endpoint
    });

    if (!response.success || !response.data) {
      logger.error('NestJS API error when fetching wagers', response.error);
      return successResponseNext({ wagers: [] });
    }

    // nestjsServerFetch returns the backend response directly: { success: true, data: [...], meta: {...} }
    // So response.data is the array, and we can access meta from the response object
    const wagers = Array.isArray(response.data) ? response.data : [];
    const meta = (response as any).meta || {
      page,
      limit,
      total: wagers.length,
      totalPages: 1,
    };

    return successResponseNext(
      { wagers },
      meta
    );
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/wagers
 * Create a new wager
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(); // Ensure user is authenticated
    const body = await request.json();

    const {
      title,
      description,
      amount,
      sideA,
      sideB,
      deadline,
      category,
      currency = 'NGN',
      isPublic = true,
      creatorSide = 'a',
    } = body;

    // Get auth token from cookies for server-side request
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to create wager
    // Backend controller returns: { success: true, data: { wager: {...} } }
    // nestjsServerFetch returns the backend response directly: { success: true, data: { wager: {...} } }
    interface CreateWagerResponse {
      success: boolean;
      data: {
        wager: {
          id: string;
          short_id: string;
          title: string;
          [key: string]: unknown;
        };
      };
    }

    const response = await nestjsServerFetch<CreateWagerResponse>('/wagers', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        title,
        description,
        amount,
        sideA,
        sideB,
        deadline,
        category,
        currency,
        isPublic,
        creatorSide,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create wager');
    }

    // nestjsServerFetch returns the backend response directly, so response.data is { wager: {...} }
    const wager = response.data.wager;

    return successResponseNext({ wager }, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

