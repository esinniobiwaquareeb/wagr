import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAdmin } from '@/lib/auth/server';
import { cookies } from 'next/headers';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

/**
 * POST /api/admin/email-templates/test
 * Test email template by sending a test email
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const { email, templateId, customData } = body;

    if (!email || !templateId) {
      return NextResponse.json(
        { error: 'Email and templateId are required' },
        { status: 400 }
      );
    }

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await nestjsServerFetch('/admin/email-templates/test', {
      method: 'POST',
      token,
      requireAuth: true,
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ email, templateId, customData }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to send test email');
    }

    return successResponseNext(response.data);
  } catch (error: any) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

