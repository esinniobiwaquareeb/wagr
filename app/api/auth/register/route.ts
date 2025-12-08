import { NextRequest } from 'next/server';
import { nestjsPost } from '@/lib/nestjs-client';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username } = body;

    // Call NestJS backend register endpoint
    const registerData = await nestjsPost<{
      message: string;
      user: {
        id: string;
        email: string;
        username: string | null;
        email_verified: boolean;
      };
    }>('/auth/register', {
      email,
      password,
      username,
    }, { requireAuth: false });

    if (!registerData) {
      throw new Error('Registration failed');
    }

    return successResponseNext({
      message: registerData.message,
      user: registerData.user,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

