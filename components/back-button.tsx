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
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export function BackButton({ 
  fallbackHref = "/wagers", 
  label = "Back",
  className = "",
  variant = "ghost",
  size = "sm"
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

