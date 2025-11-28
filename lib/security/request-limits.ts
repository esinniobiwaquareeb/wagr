/**
 * Request Size and Rate Limiting Utilities
 * Prevents DoS attacks and resource exhaustion
 */

import { NextRequest } from 'next/server';
import { AppError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';

// Maximum request body size (in bytes)
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_JSON_SIZE = 1 * 1024 * 1024; // 1MB for JSON
const MAX_URL_LENGTH = 2048; // 2KB

/**
 * Validate request size
 */
export async function validateRequestSize(request: NextRequest): Promise<void> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    
    if (isNaN(size) || size > MAX_BODY_SIZE) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Request body too large',
        undefined,
        413
      );
    }
  }
  
  // Check URL length
  const url = request.url;
  if (url.length > MAX_URL_LENGTH) {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      'URL too long',
      undefined,
      414
    );
  }
}

/**
 * Safely parse JSON with size limit
 */
export async function parseJSONSafely(request: NextRequest): Promise<any> {
  await validateRequestSize(request);
  
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_JSON_SIZE) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Request body too large',
        undefined,
        413
      );
    }
  }
  
  try {
    const text = await request.text();
    
    if (text.length > MAX_JSON_SIZE) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Request body too large',
        undefined,
        413
      );
    }
    
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      'Invalid JSON in request body'
    );
  }
}

/**
 * Validate array size to prevent DoS
 */
export function validateArraySize<T>(array: T[], maxSize: number, itemName: string = 'items'): void {
  if (array.length > maxSize) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Too many ${itemName}. Maximum allowed: ${maxSize}`
    );
  }
}

/**
 * Validate object depth to prevent deep nesting attacks
 */
export function validateObjectDepth(obj: any, maxDepth: number = 10, currentDepth: number = 0): void {
  if (currentDepth > maxDepth) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Object nesting too deep'
    );
  }
  
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        validateObjectDepth(obj[key], maxDepth, currentDepth + 1);
      }
    }
  }
}

