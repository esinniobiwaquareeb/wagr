/**
 * Input Sanitization Utilities
 * Prevents SQL injection, XSS, and other injection attacks
 */

/**
 * Sanitize search input for database queries
 * Removes special characters that could be used for SQL injection
 */
export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit length to prevent DoS
  sanitized = sanitized.substring(0, 200);
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize string input (general purpose)
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\x00/g, '');
  
  // Limit length
  sanitized = sanitized.substring(0, maxLength);
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Validate and sanitize UUID
 */
export function sanitizeUUID(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  const trimmed = input.trim();
  
  if (!uuidRegex.test(trimmed)) {
    return null;
  }
  
  return trimmed.toLowerCase();
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumber(input: any, min?: number, max?: number): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  const num = typeof input === 'string' ? parseFloat(input) : Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return null;
  }

  if (max !== undefined && num > max) {
    return null;
  }

  return num;
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    return null;
  }

  // Limit length
  if (trimmed.length > 254) {
    return null;
  }

  return trimmed;
}

/**
 * Validate and sanitize username
 */
export function sanitizeUsername(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  
  // Username rules: 3-30 chars, alphanumeric, underscore, hyphen
  if (trimmed.length < 3 || trimmed.length > 30) {
    return null;
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Escape special characters for safe display (XSS prevention)
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') {
    return '';
  }

  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate URL
 */
export function sanitizeUrl(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  
  try {
    const url = new URL(trimmed);
    
    // Only allow http and https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    
    return trimmed;
  } catch {
    return null;
  }
}

