import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { logError } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/email-templates
 * Get all email templates
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await nestjsServerFetch('/admin/email-templates', {
      method: 'GET',
      token,
      requireAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch email templates');
    }

    return successResponseNext(response.data);
  } catch (error: any) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * POST /api/admin/email-templates
 * Create a new email template
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const body = await request.json();

    const response = await nestjsServerFetch('/admin/email-templates', {
      method: 'POST',
      token,
      requireAuth: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create email template');
    }

    return successResponseNext(response.data);
  } catch (error: any) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

