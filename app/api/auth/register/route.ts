import { NextRequest } from 'next/server';
import { nestjsPost } from '@/lib/nestjs-client';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username, referral_code, country_code } = body;

    // Get client IP address for backend geolocation fallback
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Call NestJS backend register endpoint
    // Note: IP address is passed via headers in the request, backend will extract it
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
      referral_code, // Pass referral code if provided
      country_code, // Pass detected country code if provided
    }, { 
      requireAuth: false,
    });

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

