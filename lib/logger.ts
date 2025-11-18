/**
 * Simple logging utility
 * In production, these can be replaced with proper logging service
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  error: (message: string, error?: unknown) => {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    }
    // In production, send to logging service (e.g., Sentry, Logtail)
  },
  
  warn: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data);
    }
  },
  
  info: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data);
    }
  },
  
  debug: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
};

