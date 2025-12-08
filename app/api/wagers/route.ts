import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { getCurrentUser } from '@/lib/auth/server';
import { requireAuth } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse, getPaginationParams } from '@/lib/api-response';
import { cookies } from 'next/headers';

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
    // NestJS returns: { success: true, data: [...], meta: {...} }
    const response = await nestjsServerFetch<any>(`/wagers?${queryParams.toString()}`, {
      method: 'GET',
      token,
      requireAuth: false, // Public endpoint
    });

    if (!response.success) {
      console.error('NestJS API error:', response.error);
      return successResponseNext({ wagers: [] });
    }

    // nestjsServerFetch returns the raw NestJS response: { success: true, data: [...], meta: {...} }
    // So response.data is the array, and we need to check for meta at the top level
    const nestjsResponse = response as any;
    const wagers = Array.isArray(nestjsResponse.data) ? nestjsResponse.data : [];
    const meta = nestjsResponse.meta || {
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
    const response = await nestjsServerFetch<{ data: any }>('/wagers', {
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

    // NestJS returns { success: true, data: {...} } format
    const wager = response.data;

    return successResponseNext({ wager }, undefined, 201);
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

