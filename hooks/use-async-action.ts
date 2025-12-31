/**
 * Hook for handling async actions with loading states, error handling, and race condition prevention
 */

import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/error-extractor';
import { logger } from '@/lib/logger';

interface UseAsyncActionOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  preventRaceConditions?: boolean;
}

export function useAsyncAction<T = any>(
  action: (...args: any[]) => Promise<T>,
  options: UseAsyncActionOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const executingRef = useRef(false);
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    preventRaceConditions = true,
  } = options;

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    // Prevent race conditions
    if (preventRaceConditions && executingRef.current) {
      logger.warn('Action already executing, skipping duplicate call');
      return null;
    }

    executingRef.current = true;
    setLoading(true);

    try {
      const result = await action(...args);
      
      if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
          variant: "default",
        });
      }
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      logger.error('Async action failed', error);
      
      const friendlyMessage = extractErrorMessage(
        error,
        errorMessage || "Something went wrong. Please try again."
      );
      
      toast({
        title: "Error",
        description: friendlyMessage,
        variant: "destructive",
      });
      
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
      
      return null;
    } finally {
      setLoading(false);
      executingRef.current = false;
    }
  }, [action, onSuccess, onError, successMessage, errorMessage, preventRaceConditions, toast]);

  return { execute, loading };
}

