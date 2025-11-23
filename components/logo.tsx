"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "full" | "icon" | "text";
  showText?: boolean;
}

export function Logo({ 
  className, 
  size = "md", 
  variant = "full",
  showText = true 
}: LogoProps) {
  const sizeClasses = useMemo(() => {
    switch (size) {
      case "sm":
        return "h-6 w-6";
      case "lg":
        return "h-12 w-12";
      default:
        return "h-8 w-8";
    }
  }, [size]);

  const textSizeClasses = useMemo(() => {
    switch (size) {
      case "sm":
        return "text-lg";
      case "lg":
        return "text-3xl";
      default:
        return "text-xl";
    }
  }, [size]);

  if (variant === "icon") {
    return (
      <div className={cn("relative", className)}>
        <svg
          viewBox="0 0 120 120"
          className={cn(sizeClasses, "text-primary")}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Modern W shape with gradient */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          
          {/* Modern W shape - clean geometric design */}
          <path
            d="M25 95 L35 25 L50 65 L65 25 L75 95 L60 95 L55 45 L45 80 L40 45 L30 95 Z"
            fill="url(#logoGradient)"
          />
          
          {/* Accent dot representing the "app" */}
          <circle cx="50" cy="90" r="3.5" fill="currentColor" opacity="0.7" />
        </svg>
      </div>
    );
  }

  if (variant === "text") {
    return (
      <span className={cn("font-bold tracking-tight", textSizeClasses, className)}>
        wagered
        <span className="text-primary">.app</span>
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 120 120"
        className={cn(sizeClasses, "text-primary flex-shrink-0")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        
          {/* Modern W shape - clean geometric design */}
          <path
            d="M25 95 L35 25 L50 65 L65 25 L75 95 L60 95 L55 45 L45 80 L40 45 L30 95 Z"
            fill="url(#logoGradient)"
          />
          
          {/* Accent dot representing the "app" */}
          <circle cx="50" cy="90" r="3.5" fill="currentColor" opacity="0.7" />
      </svg>
      {showText && (
        <span className={cn("font-bold tracking-tight", textSizeClasses)}>
          wagered
          <span className="text-primary">.app</span>
        </span>
      )}
    </div>
  );
}

