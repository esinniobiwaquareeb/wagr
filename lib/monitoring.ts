/**
 * Monitoring and Observability Utilities
 * Provides structured logging, error tracking, and performance monitoring
 */

import { logError, AppError, ErrorCode } from './error-handler';

export interface MonitoringContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  userAgent?: string;
  ipAddress?: string;
  [key: string]: any;
}

/**
 * Initialize error tracking service (Sentry)
 * This is optional - if SENTRY_DSN is not set, monitoring will use console logging
 */
let errorTrackingInitialized = false;

export function initializeErrorTracking() {
  if (errorTrackingInitialized) return;
  
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!sentryDsn) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Monitoring] Error tracking not configured (SENTRY_DSN not set)');
    }
    errorTrackingInitialized = true;
    return;
  }

  // Only try to import Sentry if DSN is provided
  // Use a try-catch wrapper to handle cases where Sentry is not installed
  const initSentry = async () => {
    try {
      // Use Function constructor to prevent Next.js from analyzing the import
      const importSentry = new Function('return import("@sentry/nextjs")');
      const Sentry = await importSentry().catch(() => null);
      if (!Sentry) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Monitoring] Sentry package not installed. Install @sentry/nextjs to enable error tracking.');
        }
        errorTrackingInitialized = true;
        return;
      }

      Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        beforeSend(event: any, hint: any) {
          // Filter out non-critical errors in production
          if (process.env.NODE_ENV === 'production') {
            const error = hint?.originalException;
            if (error instanceof AppError) {
              // Don't track validation errors or user errors
              if ([
                ErrorCode.VALIDATION_ERROR,
                ErrorCode.INVALID_INPUT,
                ErrorCode.INVALID_CREDENTIALS,
              ].includes(error.code)) {
                return null;
              }
            }
          }
          return event;
        },
      });
      errorTrackingInitialized = true;
      if (process.env.NODE_ENV === 'development') {
        console.log('[Monitoring] Error tracking initialized (Sentry)');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Monitoring] Failed to initialize Sentry:', error);
      }
      errorTrackingInitialized = true;
    }
  };

  // Initialize asynchronously (don't block)
  initSentry();
}

/**
 * Capture exception with context
 */
export function captureException(error: Error | AppError, context?: MonitoringContext) {
  logError(error, context);

  if (!errorTrackingInitialized) {
    initializeErrorTracking();
  }

  // Try to use Sentry if available (only if DSN is set)
  // Use eval to prevent Next.js from analyzing the import at build time
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      // Dynamic import with error handling
      const importSentry = new Function('return import("@sentry/nextjs")');
      importSentry().then((Sentry: any) => {
        Sentry.captureException(error, {
          extra: context,
          tags: error instanceof AppError ? {
            errorCode: error.code,
            statusCode: error.statusCode.toString(),
          } : undefined,
        });
      }).catch(() => {
        // Sentry not available, already logged via logError
      });
    } catch {
      // Ignore if Sentry is not installed
    }
  }
}

/**
 * Capture message with context
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: MonitoringContext) {
  console.log(`[${level.toUpperCase()}] ${message}`, context || '');

  if (!errorTrackingInitialized) {
    initializeErrorTracking();
  }

  // Try to use Sentry if available (only if DSN is set)
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      const importSentry = new Function('return import("@sentry/nextjs")');
      importSentry().then((Sentry: any) => {
        Sentry.captureMessage(message, {
          level: level === 'info' ? 'info' : level === 'warning' ? 'warning' : 'error',
          extra: context,
        });
      }).catch(() => {
        // Sentry not available
      });
    } catch {
      // Ignore if Sentry is not installed
    }
  }
}

/**
 * Track performance metric
 */
export function trackPerformance(metricName: string, duration: number, context?: MonitoringContext) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${metricName}: ${duration}ms`, context || '');
  }

  // Could integrate with analytics service here
  // e.g., Google Analytics, Vercel Analytics, etc.
}

/**
 * Track custom event
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Event] ${eventName}`, properties || '');
  }

  // Could integrate with analytics service here
  // e.g., Google Analytics, Mixpanel, etc.
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, userData?: { email?: string; username?: string }) {
  if (!errorTrackingInitialized) {
    initializeErrorTracking();
  }

  // Only set user context if Sentry is configured
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      const importSentry = new Function('return import("@sentry/nextjs")');
      importSentry().then((Sentry: any) => {
        Sentry.setUser({
          id: userId,
          email: userData?.email,
          username: userData?.username,
        });
      }).catch(() => {
        // Sentry not available
      });
    } catch {
      // Ignore if Sentry is not installed
    }
  }
}

/**
 * Clear user context
 */
export function clearUserContext() {
  // Only clear user context if Sentry is configured
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      const importSentry = new Function('return import("@sentry/nextjs")');
      importSentry().then((Sentry: any) => {
        Sentry.setUser(null);
      }).catch(() => {
        // Sentry not available
      });
    } catch {
      // Ignore if Sentry is not installed
    }
  }
}

