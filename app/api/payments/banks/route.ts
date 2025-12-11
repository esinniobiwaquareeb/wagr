import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { logError } from '@/lib/error-handler';

/**
 * GET /api/payments/banks
 * Proxy to NestJS backend banks endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const country = url.searchParams.get('country') || 'nigeria';
    
    // Call NestJS backend banks endpoint (public, no auth required)
    const response = await nestjsServerFetch<Array<{ code: string; name: string }>>(
      `/payments/banks?country=${country}`,
      {
        method: 'GET',
        requireAuth: false, // Public endpoint
      }
    );

    if (!response.success) {
      return NextResponse.json(
        { error: response.error?.message || 'Failed to fetch banks' },
        { status: 400 }
      );
    }

    // Return in the format expected by frontend
    return NextResponse.json({
      success: true,
      banks: response.data || [],
    });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
