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
 */
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

  // Handle string errors
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed || safeFallback;
  }

  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message?.trim();
    return message || safeFallback;
  }

  // Handle objects with error property (API responses)
  if (typeof error === 'object') {
    const errorObj = error as ErrorResponse | { message?: string; error?: any };
    
    // Check for nested error.message (API format: { error: { message: "..." } })
    if (errorObj.error) {
      if (typeof errorObj.error === 'string') {
        const trimmed = errorObj.error.trim();
        return trimmed || safeFallback;
      }
      if (typeof errorObj.error === 'object' && errorObj.error !== null) {
        const nestedError = errorObj.error as { message?: string };
        if (nestedError.message) {
          const message = nestedError.message.trim();
          return message || safeFallback;
        }
      }
    }
    
    // Check for top-level message
    if (errorObj.message) {
      const message = String(errorObj.message).trim();
      return message || safeFallback;
    }
  }

  // Fallback for unknown types
  try {
    const stringified = String(error);
    if (stringified && stringified !== '[object Object]') {
      const trimmed = stringified.trim();
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

