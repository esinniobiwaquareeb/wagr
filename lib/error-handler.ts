/**
 * Centralized Error Handling
 */

export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Business logic errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  WAGER_EXPIRED = 'WAGER_EXPIRED',
  WAGER_NOT_FOUND = 'WAGER_NOT_FOUND',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_JOINED = 'ALREADY_JOINED',
  WITHDRAWAL_LIMIT_EXCEEDED = 'WITHDRAWAL_LIMIT_EXCEEDED',
  
  // Payment errors
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_VERIFICATION_FAILED = 'PAYMENT_VERIFICATION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // 2FA errors
  TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID = 'TWO_FACTOR_INVALID',
  TWO_FACTOR_NOT_ENABLED = 'TWO_FACTOR_NOT_ENABLED',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: any;
  statusCode: number;
}

export class AppError extends Error {
  code: ErrorCode;
  details?: any;
  statusCode: number;

  constructor(code: ErrorCode, message: string, details?: any, statusCode?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode || getDefaultStatusCode(code);
  }
}

function getDefaultStatusCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.INVALID_CREDENTIALS:
    case ErrorCode.SESSION_EXPIRED:
      return 401;
    case ErrorCode.FORBIDDEN:
    case ErrorCode.ACCOUNT_SUSPENDED:
    case ErrorCode.ACCOUNT_DELETED:
    case ErrorCode.EMAIL_NOT_VERIFIED:
      return 403;
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED_FIELD:
      return 400;
    case ErrorCode.WAGER_NOT_FOUND:
      return 404;
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 429;
    case ErrorCode.INTERNAL_ERROR:
    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
      return 500;
    default:
      return 400;
  }
}

/**
 * Create user-friendly error messages
 */
export function getUserFriendlyMessage(error: Error | AppError): string {
  if (error instanceof AppError) {
    // Return the message as-is (should already be user-friendly)
    return error.message;
  }

  // Handle common error types
  if (error.message.includes('network') || error.message.includes('fetch')) {
    return "Looks like there's a connection issue. Check your internet and try again.";
  }

  if (error.message.includes('timeout')) {
    return "This is taking longer than expected. Give it another shot.";
  }

  // Generic fallback
  return "Something went wrong on our end. Please try again in a moment.";
}

/**
 * Log error for monitoring
 */
export function logError(error: Error | AppError, context?: any) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    ...(error instanceof AppError && {
      code: error.code,
      details: error.details,
      statusCode: error.statusCode,
    }),
    context,
    timestamp: new Date().toISOString(),
  };

  // In production, send to error tracking service (e.g., Sentry)
  console.error('Error:', errorInfo);

  // Use monitoring utility for error tracking
  if (typeof window === 'undefined') {
    // Server-side: dynamically import to avoid bundling issues
    import('./monitoring').then(({ captureException }) => {
      captureException(error, context);
    }).catch(() => {
      // Monitoring not available, already logged
    });
  } else {
    // Client-side: dynamically import to avoid bundling issues
    import('./monitoring').then(({ captureException }) => {
      captureException(error, context);
    }).catch(() => {
      // Monitoring not available, already logged
    });
  }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error | AppError) {
  const isAppError = error instanceof AppError;
  
  return {
    error: {
      code: isAppError ? error.code : ErrorCode.INTERNAL_ERROR,
      message: getUserFriendlyMessage(error),
      ...(isAppError && error.details && { details: error.details }),
    },
  };
}

