"use client";

import { useMemo } from "react";
import Image from "next/image";
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

  const imageSizeClasses = useMemo(() => {
    switch (size) {
      case "sm":
        return { width: 80, height: 24 };
      case "lg":
        return { width: 160, height: 48 };
      default:
        return { width: 120, height: 36 };
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

  // Variant 1-4: All use logo image
  if (variant === "v1" || variant === "v2" || variant === "v3" || variant === "v4") {
    return (
      <div className={cn("relative flex items-center m-0 p-0", className)}>
        <Image
          src="/logo.png"
          alt="wagr"
          width={imageSizeClasses.width}
          height={imageSizeClasses.height}
          className="object-contain block m-0 p-0"
          priority
        />
      </div>
    );
  }

  if (variant === "icon") {
    const iconSize = size === "sm" ? { width: 32, height: 32 } : size === "lg" ? { width: 64, height: 64 } : { width: 48, height: 48 };
    return (
      <div className={cn("relative flex items-center justify-center m-0 p-0", className)}>
        <Image
          src="/logo.png"
          alt="wagr"
          width={iconSize.width}
          height={iconSize.height}
          className="object-contain block m-0 p-0"
          priority
        />
      </div>
    );
  }

  if (variant === "text") {
    // For text variant, use logo image but smaller
    const textImageSize = size === "sm" ? { width: 100, height: 30 } : size === "lg" ? { width: 200, height: 60 } : { width: 150, height: 45 };
    return (
      <div className={cn("relative flex items-center m-0 p-0", className)}>
        <Image
          src="/logo.png"
          alt="wagr"
          width={textImageSize.width}
          height={textImageSize.height}
          className="object-contain block m-0 p-0"
          priority
        />
      </div>
    );
  }

  // Default "full" variant: Use logo image
  return (
    <div className={cn("relative flex items-center m-0 p-0", className)}>
      <Image
        src="/logo.png"
        alt="wagr"
        width={imageSizeClasses.width}
        height={imageSizeClasses.height}
        className="object-contain block m-0 p-0"
        priority
      />
    </div>
  );
}
