/**
 * Robust error message extraction utility
 * Handles various error formats from API responses, errors, and unknown types
 */

export interface ErrorResponse {
  error?: {
    message?: string;
    code?: string;
    details?: any;
  };
  message?: string;
}

/**
 * Extract a user-friendly error message from various error formats
 * Always returns a non-empty string (uses fallback if needed)
 * Maps technical errors to user-friendly messages
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Network request failed': "Connection issue. Check your internet and try again.",
  'Failed to fetch': "Can't connect to server. Please check your connection.",
  'fetch failed': "Network error. Please try again.",
  'ECONNREFUSED': "Server is unavailable. Please try again later.",
  'timeout': "Request took too long. Please try again.",
  'UNAUTHORIZED': "Please log in to continue.",
  'FORBIDDEN': "You don't have permission to do this.",
  'NOT_FOUND': "The requested item was not found.",
  'VALIDATION_ERROR': "Please check your input and try again.",
  'INSUFFICIENT_BALANCE': "You don't have enough balance for this action.",
  'WAGER_EXPIRED': "This wager has expired.",
  'ALREADY_JOINED': "You've already joined this wager.",
  'ACCOUNT_SUSPENDED': "Your account has been suspended. Please contact support.",
  'ACCOUNT_DELETED': "This account has been deleted.",
  'EMAIL_NOT_VERIFIED': "Please verify your email address.",
  'RATE_LIMIT_EXCEEDED': "Too many requests. Please wait a moment and try again.",
};

export function extractErrorMessage(
  error: unknown,
  fallback: string = "Something went wrong. Please try again."
): string {
  // Ensure fallback is never empty
  const safeFallback = fallback?.trim() || "Something went wrong. Please try again.";
  
  // Handle null/undefined
  if (error == null) {
    return safeFallback;
  }

  let rawMessage = '';

  // Handle string errors
  if (typeof error === 'string') {
    rawMessage = error.trim();
  }
  // Handle Error instances
  else if (error instanceof Error) {
    rawMessage = error.message?.trim() || '';
    // Check for error code
    const errorCode = (error as any).code;
    if (errorCode && ERROR_MESSAGE_MAP[errorCode]) {
      return ERROR_MESSAGE_MAP[errorCode];
    }
  }
  // Handle objects with error property (API responses)
  else if (typeof error === 'object') {
    const errorObj = error as ErrorResponse | { message?: string; error?: any; code?: string };
    
    // Check for error code first
    if ('code' in errorObj && errorObj.code && typeof errorObj.code === 'string' && ERROR_MESSAGE_MAP[errorObj.code]) {
      return ERROR_MESSAGE_MAP[errorObj.code];
    }
    
    // Check for nested error.message (API format: { error: { message: "..." } })
    if (errorObj.error) {
      if (typeof errorObj.error === 'string') {
        rawMessage = errorObj.error.trim();
      } else if (typeof errorObj.error === 'object' && errorObj.error !== null) {
        const nestedError = errorObj.error as { message?: string; code?: string };
        if (nestedError.code && ERROR_MESSAGE_MAP[nestedError.code]) {
          return ERROR_MESSAGE_MAP[nestedError.code];
        }
        if (nestedError.message) {
          rawMessage = nestedError.message.trim();
        }
      }
    }
    
    // Check for top-level message
    if (!rawMessage && errorObj.message) {
      rawMessage = String(errorObj.message).trim();
    }
  }

  // If we have a raw message, check if it needs mapping
  if (rawMessage) {
    // Check exact match first
    if (ERROR_MESSAGE_MAP[rawMessage]) {
      return ERROR_MESSAGE_MAP[rawMessage];
    }
    
    // Check for partial matches (case-insensitive)
    const upperMessage = rawMessage.toUpperCase();
    for (const [key, value] of Object.entries(ERROR_MESSAGE_MAP)) {
      if (upperMessage.includes(key.toUpperCase())) {
        return value;
      }
    }
    
    // Return the raw message if it's user-friendly
    if (rawMessage.length > 0 && !rawMessage.includes('Error:') && !rawMessage.includes('TypeError')) {
      return rawMessage;
    }
  }

  // Fallback for unknown types
  try {
    const stringified = String(error);
    if (stringified && stringified !== '[object Object]') {
      const trimmed = stringified.trim();
      // Check if it's a technical error that needs mapping
      for (const [key, value] of Object.entries(ERROR_MESSAGE_MAP)) {
        if (trimmed.toUpperCase().includes(key.toUpperCase())) {
          return value;
        }
      }
      return trimmed || safeFallback;
    }
  } catch {
    // Ignore stringification errors
  }

  return safeFallback;
}

/**
 * Extract error message from API response
 * Handles both successful responses with error data and failed responses
 * Always returns a non-empty string (uses fallback if needed)
 */
export async function extractErrorFromResponse(
  response: Response,
  fallback: string = "Something went wrong. Please try again."
): Promise<string> {
  // Ensure fallback is never empty
  const safeFallback = fallback?.trim() || "Something went wrong. Please try again.";
  
  try {
    const data = await response.json();
    
    // Check for error object in response
    if (data.error) {
      if (typeof data.error === 'string') {
        const trimmed = data.error.trim();
        if (trimmed) {
          return trimmed;
        }
      }
      if (typeof data.error === 'object' && data.error !== null) {
        const errorObj = data.error as { message?: string; details?: any };
        
        // Check for Paystack error message in details
        if (errorObj.details?.paystackError?.message) {
          const paystackMessage = String(errorObj.details.paystackError.message).trim();
          if (paystackMessage) {
            return paystackMessage;
          }
        }
        
        // Check for error message
        const errorMessage = errorObj.message?.trim();
        if (errorMessage) {
          return errorMessage;
        }
      }
    }
    
    // Check for top-level message
    if (data.message) {
      const message = String(data.message).trim();
      if (message) {
        return message;
      }
    }
    
    // Use status text as fallback
    if (response.statusText) {
      const statusText = response.statusText.trim();
      return statusText || safeFallback;
    }
    
    return safeFallback;
  } catch {
    // If JSON parsing fails, use status text or fallback
    const statusText = response.statusText?.trim();
    return statusText || safeFallback;
  }
}

