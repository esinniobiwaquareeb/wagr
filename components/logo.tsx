"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "full" | "icon" | "text" | "v1" | "v2" | "v3" | "v4";
}

export function Logo({ 
  className, 
  size = "md", 
  variant = "full"
}: LogoProps) {

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

  // Variant 1: Space Grotesk - Modern, condensed, tech-forward
  if (variant === "v1") {
    return (
      <span 
        className={cn(
          "font-bold tracking-tight",
          textSizeClasses,
          className
        )}
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <span className="text-foreground">wagered</span>
        <span className="text-primary">.app</span>
      </span>
    );
  }

  // Variant 2: Outfit - Clean, geometric, confident
  if (variant === "v2") {
    return (
      <span 
        className={cn(
          "font-bold tracking-tight",
          textSizeClasses,
          className
        )}
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <span className="text-foreground">wagered</span>
        <span className="text-primary">.app</span>
      </span>
    );
  }

  // Variant 3: Rajdhani - Bold, modern, tech-inspired
  if (variant === "v3") {
    return (
      <span 
        className={cn(
          "font-bold tracking-wide uppercase",
          textSizeClasses,
          className
        )}
        style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.05em" }}
      >
        <span className="text-foreground">wagered</span>
        <span className="text-primary">.app</span>
      </span>
    );
  }

  // Variant 4: DM Sans - Minimalist, clean, professional
  if (variant === "v4") {
    return (
      <span 
        className={cn(
          "font-bold tracking-normal",
          textSizeClasses,
          className
        )}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <span className="text-foreground">wagered</span>
        <span className="text-primary">.app</span>
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <div className={cn("relative flex items-center justify-center", className)}>
        <span 
          className={cn(
            "font-bold text-primary",
            size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl"
          )}
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          W
        </span>
      </div>
    );
  }

  if (variant === "text") {
    return (
      <span 
        className={cn(
          "font-bold tracking-tight",
          textSizeClasses,
          className
        )}
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <span className="text-foreground">wagered</span>
        <span className="text-primary">.app</span>
      </span>
    );
  }

  // Default "full" variant: Use v1 (Space Grotesk)
  return (
    <span 
      className={cn(
        "font-bold tracking-tight",
        textSizeClasses,
        className
      )}
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <span className="text-foreground">wagered</span>
      {/* <span className="text-primary">.app</span> */}
    </span>
  );
}
