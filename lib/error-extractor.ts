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
 */
export function extractErrorMessage(
  error: unknown,
  fallback: string = "Something went wrong. Please try again."
): string {
  // Handle null/undefined
  if (error == null) {
    return fallback;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message?.trim();
    return message || fallback;
  }

  // Handle objects with error property (API responses)
  if (typeof error === 'object') {
    const errorObj = error as ErrorResponse | { message?: string; error?: any };
    
    // Check for nested error.message (API format: { error: { message: "..." } })
    if (errorObj.error) {
      if (typeof errorObj.error === 'string') {
        return errorObj.error.trim() || fallback;
      }
      if (typeof errorObj.error === 'object' && errorObj.error !== null) {
        const nestedError = errorObj.error as { message?: string };
        if (nestedError.message) {
          const message = nestedError.message.trim();
          return message || fallback;
        }
      }
    }
    
    // Check for top-level message
    if (errorObj.message) {
      const message = String(errorObj.message).trim();
      return message || fallback;
    }
  }

  // Fallback for unknown types
  try {
    const stringified = String(error);
    if (stringified && stringified !== '[object Object]') {
      return stringified.trim() || fallback;
    }
  } catch {
    // Ignore stringification errors
  }

  return fallback;
}

/**
 * Extract error message from API response
 * Handles both successful responses with error data and failed responses
 */
export async function extractErrorFromResponse(
  response: Response,
  fallback: string = "Something went wrong. Please try again."
): Promise<string> {
  try {
    const data = await response.json();
    
    // Check for error object in response
    if (data.error) {
      if (typeof data.error === 'string') {
        return data.error.trim() || fallback;
      }
      if (typeof data.error === 'object' && data.error !== null) {
        const errorMessage = data.error.message?.trim();
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
      return response.statusText;
    }
    
    return fallback;
  } catch {
    // If JSON parsing fails, use status text or fallback
    return response.statusText || fallback;
  }
}

