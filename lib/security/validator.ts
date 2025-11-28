/**
 * Security Validation Utilities
 * Centralized validation for security-critical operations
 */

import { AppError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { sanitizeUUID, sanitizeString, sanitizeNumber, sanitizeEmail, sanitizeUsername } from './input-sanitizer';

/**
 * Validate and sanitize UUID parameter
 */
export function validateUUIDParam(id: string, paramName: string = 'id'): string {
  const sanitized = sanitizeUUID(id);
  if (!sanitized) {
    throw new AppError(ErrorCode.INVALID_INPUT, `Invalid ${paramName}: must be a valid UUID`);
  }
  return sanitized;
}

/**
 * Validate and sanitize ID parameter (UUID or short_id)
 */
export function validateIDParam(id: string, paramName: string = 'id', allowShortId: boolean = true): string {
  // Try UUID first
  const uuid = sanitizeUUID(id);
  if (uuid) {
    return uuid;
  }
  
  // If short_id allowed, validate it
  if (allowShortId) {
    const shortId = sanitizeString(id, 20);
    if (shortId && shortId.length >= 6 && /^[a-zA-Z0-9]+$/.test(shortId)) {
      return shortId;
    }
  }
  
  throw new AppError(ErrorCode.INVALID_INPUT, `Invalid ${paramName}`);
}

/**
 * Validate user owns resource
 */
export function validateOwnership(
  resourceUserId: string | null | undefined,
  currentUserId: string,
  resourceName: string = 'resource'
): void {
  if (!resourceUserId) {
    throw new AppError(ErrorCode.NOT_FOUND, `${resourceName} not found`);
  }
  
  if (resourceUserId !== currentUserId) {
    throw new AppError(ErrorCode.FORBIDDEN, `You do not have permission to access this ${resourceName}`);
  }
}

/**
 * Validate user is admin
 */
export function validateAdmin(isAdmin: boolean): void {
  if (!isAdmin) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Admin access required');
  }
}

/**
 * Validate request body has required fields
 */
export function validateRequiredFields(body: any, fields: string[]): void {
  const missing: string[] = [];
  
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      `Missing required fields: ${missing.join(', ')}`
    );
  }
}

/**
 * Validate numeric amount
 */
export function validateAmount(amount: any, min: number = 0, max?: number): number {
  const num = sanitizeNumber(amount, min, max);
  if (num === null) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      max ? `Amount must be between ${min} and ${max}` : `Amount must be at least ${min}`
    );
  }
  return num;
}

/**
 * Validate email input
 */
export function validateEmailInput(email: any): string {
  const sanitized = sanitizeEmail(email);
  if (!sanitized) {
    throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid email address');
  }
  return sanitized;
}

/**
 * Validate username input
 */
export function validateUsernameInput(username: any): string {
  const sanitized = sanitizeUsername(username);
  if (!sanitized) {
    throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid username');
  }
  return sanitized;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, limit?: number): { page: number; limit: number } {
  const validatedPage = Math.max(1, Math.floor(page || 1));
  const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
  };
}

