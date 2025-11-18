"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ 
  size = 'md', 
  text, 
  fullScreen = false,
  className 
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <Spinner className={cn(sizeClasses[size], "text-primary")} />
      {text && (
        <p className="text-sm text-muted-foreground mt-4">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {spinner}
      </div>
    );
  }

  return spinner;
}

