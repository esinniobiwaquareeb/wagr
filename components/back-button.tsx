"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
  className?: string;
  variant?: "default" | "ghost" | "outline" | "floating";
  size?: "default" | "sm" | "lg" | "icon";
  position?: "inline" | "floating" | "standalone";
}

export function BackButton({ 
  fallbackHref = "/wagers", 
  label = "Back",
  className = "",
  variant = "ghost",
  size = "sm",
  position = "inline"
}: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Check if there's history to go back to
    if (typeof window !== 'undefined') {
      // Check if we have a referrer or history
      const hasReferrer = document.referrer && document.referrer !== window.location.href;
      const hasHistory = window.history.length > 1;
      setCanGoBack(hasReferrer || hasHistory);
    }
  }, []);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      // Fallback to a sensible default
      router.push(fallbackHref);
    }
  };

  // Don't show on landing page or home
  if (pathname === "/" || pathname === "/landing") {
    return null;
  }

  // Floating variant - compact icon button that overlays content
  if (position === "floating" || variant === "floating") {
    return (
      <button
        onClick={handleBack}
        className={`fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-background hover:shadow-xl transition-all hover:scale-105 active:scale-95 ${className}`}
        aria-label={label}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
    );
  }

  // Inline variant - compact button that fits in header
  if (position === "inline") {
    return (
      <button
        onClick={handleBack}
        className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
        aria-label={label}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }

  // Standalone variant - original button style
  return (
    <Button
      onClick={handleBack}
      variant={variant}
      size={size}
      className={`flex items-center gap-1.5 md:gap-2 ${className}`}
      aria-label={label}
    >
      <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
      <span className="text-xs md:text-sm font-medium">{label}</span>
    </Button>
  );
}

