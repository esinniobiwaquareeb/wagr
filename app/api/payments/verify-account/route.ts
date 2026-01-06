import { NextRequest } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';
import { requireAuth } from '@/lib/auth/server';
import { logError, AppError, ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { cookies } from 'next/headers';

/**
 * POST /api/payments/verify-account
 * Verify bank account details (proxied to backend)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Account number and bank code are required');
    }

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Call NestJS backend to verify account
    const response = await nestjsServerFetch<{ account_name: string }>('/payments/verify-account', {
      method: 'POST',
      token,
      requireAuth: true,
      body: JSON.stringify({
        accountNumber,
        bankCode,
      }),
    });

    if (!response.success || !response.data) {
      // Map backend error codes to frontend error codes
      const backendError = response.error;
      if (backendError) {
        let errorCode: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR;
        const backendCode = backendError.code || '';
        const statusCode = backendError.statusCode || 500;
        const errorMessage = backendError.message || 'Failed to verify account';

        // Map backend exception names to frontend error codes
        if (backendCode.includes('BadRequestException') || statusCode === 400) {
          // Check for specific error messages
          if (errorMessage.toLowerCase().includes('limit') || errorMessage.toLowerCase().includes('exceeded')) {
            errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
          } else if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('invalid')) {
            errorCode = ErrorCode.VALIDATION_ERROR;
          } else {
            errorCode = ErrorCode.VALIDATION_ERROR;
          }
        } else if (backendCode.includes('NotFoundException') || statusCode === 404) {
          errorCode = ErrorCode.NOT_FOUND;
        } else if (backendCode.includes('UnauthorizedException') || statusCode === 401) {
          errorCode = ErrorCode.UNAUTHORIZED;
        } else if (statusCode === 429) {
          errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
        }

        throw new AppError(
          errorCode,
          errorMessage,
          backendError.details,
          statusCode
        );
      }
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to verify account');
    }

    return successResponseNext({
      accountName: response.data.account_name,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

