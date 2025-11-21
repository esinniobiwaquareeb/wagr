/**
 * Uniform API Response Format
 * All API endpoints should use this format for consistency
 */

import { NextResponse } from 'next/server';
import { AppError, ErrorCode } from './error-handler';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>['meta']
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

/**
 * Create an error API response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: any,
  statusCode?: number
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return NextResponse.json(response, {
    status: statusCode || 400,
  });
}

/**
 * Create a successful API response with NextResponse
 */
export function successResponseNext<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };

  return NextResponse.json(response, { status });
}

/**
 * Convert AppError to API error response
 */
export function appErrorToResponse(error: any): NextResponse {
  const isAppError = error instanceof AppError || (error?.code && error?.statusCode);
  
  if (isAppError) {
    return errorResponse(
      error.code,
      error.message,
      error.details,
      error.statusCode
    );
  }

  return errorResponse(
    ErrorCode.INTERNAL_ERROR,
    error?.message || 'An unexpected error occurred',
    undefined,
    500
  );
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export function getPaginationParams(request: Request): { page: number; limit: number } {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || '20', 10),
    100 // Max limit
  );

  return { page: page || 1, limit: limit || 20 };
}

export function getPaginationMeta(
  page: number,
  limit: number,
  total: number
): ApiResponse['meta'] {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

