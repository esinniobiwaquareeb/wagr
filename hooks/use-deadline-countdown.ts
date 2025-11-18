import { useState, useEffect, useMemo } from 'react';
import { parseDeadline, getTimeRemaining } from '@/lib/deadline-utils';

export type DeadlineStatus = 'green' | 'orange' | 'red';

export interface DeadlineCountdownResult {
  countdown: string; // HH:MM:SS format
  timeRemaining: number; // milliseconds
  status: DeadlineStatus;
  hasElapsed: boolean;
}

/**
 * Format milliseconds as HH:MM:SS
 */
export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return "00:00:00";
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Calculate deadline status based on time remaining
 */
function calculateDeadlineStatus(minutesLeft: number): DeadlineStatus {
  if (minutesLeft <= 0) return 'red';
  if (minutesLeft <= 30) return 'orange';
  return 'green';
}

/**
 * Hook for real-time deadline countdown
 * Updates every second and provides formatted countdown string and status
 */
export function useDeadlineCountdown(deadline: string | null | undefined): DeadlineCountdownResult {
  // Parse deadline once
  const deadlineDate = useMemo(() => deadline ? parseDeadline(deadline) : null, [deadline]);
  
  // Real-time countdown state
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [status, setStatus] = useState<DeadlineStatus>('green');
  
  // Update countdown in real-time
  useEffect(() => {
    if (!deadlineDate) {
      setTimeRemaining(0);
      setStatus('green');
      return;
    }
    
    const updateCountdown = () => {
      const remaining = getTimeRemaining(deadlineDate);
      setTimeRemaining(remaining);
      
      const minutesLeft = remaining / (1000 * 60);
      setStatus(calculateDeadlineStatus(minutesLeft));
    };
    
    // Update immediately
    updateCountdown();
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [deadlineDate]);
  
  return {
    countdown: formatCountdown(timeRemaining),
    timeRemaining,
    status,
    hasElapsed: timeRemaining <= 0,
  };
}

