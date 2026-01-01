"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, CheckCircle2 } from "lucide-react";

interface AchievementBadgeProps {
  icon: string;
  title: string;
  description?: string;
  requirement?: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  className?: string;
}

export function AchievementBadge({
  icon,
  title,
  description,
  requirement,
  unlocked,
  progress = 0,
  target = 1,
  size = "md",
  showProgress = false,
  className,
}: AchievementBadgeProps) {
  const progressPercentage = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  
  const sizeClasses = {
    sm: "h-10 w-10 text-base",
    md: "h-14 w-14 text-xl",
    lg: "h-20 w-20 text-3xl",
  };

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-semibold">{title}</div>
      {description && <div className="text-xs text-muted-foreground">{description}</div>}
      {requirement && (
        <div className="text-xs text-muted-foreground">
          {unlocked ? (
            <span className="text-green-400">✓ Unlocked</span>
          ) : (
            <span>Requires: {requirement}</span>
          )}
        </div>
      )}
      {showProgress && !unlocked && target > 0 && (
        <div className="text-xs text-muted-foreground">
          Progress: {progress} / {target} ({progressPercentage}%)
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative rounded-full flex items-center justify-center transition-all cursor-pointer",
              "border-2 shadow-lg hover:scale-110 active:scale-95",
              sizeClasses[size],
              unlocked
                ? "bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 border-yellow-500/50 text-yellow-500 hover:border-yellow-400 hover:shadow-yellow-500/20"
                : "bg-muted/50 border-border/50 text-muted-foreground/50 hover:border-muted-foreground/50 grayscale",
              className
            )}
          >
            {/* Icon */}
            <span className={cn("leading-none", unlocked ? "" : "opacity-50")}>
              {icon}
            </span>

            {/* Unlocked indicator */}
            {unlocked && (
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                <CheckCircle2 className="h-2.5 w-2.5 text-white" />
              </div>
            )}

            {/* Locked indicator - subtle overlay */}
            {!unlocked && (
              <div className="absolute inset-0 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center">
                <Lock className={cn(
                  "text-muted-foreground/70",
                  size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-6 w-6"
                )} />
              </div>
            )}

            {/* Progress ring for locked achievements */}
            {!unlocked && showProgress && target > 0 && progressPercentage > 0 && (
              <svg
                className="absolute inset-0 -rotate-90"
                width="100%"
                height="100%"
              >
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${2 * Math.PI * 45}%`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressPercentage / 100)}%`}
                  className="text-primary/30"
                  style={{ transition: "stroke-dashoffset 0.3s ease" }}
                />
              </svg>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

