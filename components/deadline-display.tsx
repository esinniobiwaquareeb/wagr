"use client";

import { Clock } from "lucide-react";
import { useDeadlineCountdown } from "@/hooks/use-deadline-countdown";

interface DeadlineDisplayProps {
  deadline: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  cardFormat?: boolean; // If true, displays in card format (icon+label on top, countdown below)
}

export function DeadlineDisplay({ 
  deadline, 
  size = 'md',
  showLabel = true,
  className = '',
  cardFormat = false
}: DeadlineDisplayProps) {
  const { countdown, status, hasElapsed } = useDeadlineCountdown(deadline);

  if (!deadline) return null;

  const sizeClasses = {
    sm: {
      icon: 'h-3 w-3',
      text: 'text-xs',
      label: 'text-[9px]'
    },
    md: {
      icon: 'h-4 w-4 md:h-5 md:w-5',
      text: 'text-xs md:text-sm',
      label: 'text-[10px] md:text-xs'
    },
    lg: {
      icon: 'h-5 w-5 md:h-6 md:w-6',
      text: 'text-sm md:text-base',
      label: 'text-xs md:text-sm'
    }
  };

  const currentSize = sizeClasses[size];

  const statusColors = {
    red: 'text-red-600 dark:text-red-400',
    orange: 'text-orange-600 dark:text-orange-400',
    green: 'text-muted-foreground',
  };

  // Card format: icon + label on top, countdown below (matches Entry Fee card format)
  if (cardFormat) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 mb-1">
          <Clock 
            className={`${currentSize.icon} ${
              status === 'red' 
                ? 'text-red-600 dark:text-red-400' 
                : status === 'orange'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-muted-foreground'
            } ${(status === 'orange' || status === 'red') ? 'animate-pulse' : ''}`} 
          />
          {showLabel && (
            <span className={`${currentSize.label} text-muted-foreground`}>Deadline</span>
          )}
        </div>
        <p className={`text-lg md:text-2xl font-bold font-mono tabular-nums ${statusColors[status]}`}>
          {countdown}
        </p>
      </div>
    );
  }

  // Inline format: icon, label, and countdown in a row
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Clock 
        className={`${currentSize.icon} ${
          status === 'red' 
            ? 'text-red-600 dark:text-red-400' 
            : status === 'orange'
            ? 'text-orange-600 dark:text-orange-400'
            : 'text-muted-foreground'
        } ${(status === 'orange' || status === 'red') ? 'animate-pulse' : ''}`} 
      />
      {showLabel && (
        <span className={`${currentSize.label} text-muted-foreground`}>Deadline</span>
      )}
      <span className={`${currentSize.text} font-mono tabular-nums font-bold ${statusColors[status]}`}>
        {countdown}
      </span>
    </div>
  );
}

