import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { cookies } from 'next/headers';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
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
    const token = cookieStore.get('admin_token')?.value || null;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to send test email');
    }

    return successResponseNext(response.data);
  } catch (error: any) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

