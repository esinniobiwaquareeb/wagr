"use client";

import { AchievementBadge } from "@/components/achievement-badge";
import { cn } from "@/lib/utils";

interface Achievement {
  type: string;
  title: string;
  description?: string;
  requirement?: string;
  icon?: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
  progress_percentage?: number;
}

interface UserAchievementBadgesProps {
  achievements: Achievement[];
  maxDisplay?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showAll?: boolean;
}

export function UserAchievementBadges({
  achievements,
  maxDisplay = 3,
  size = "sm",
  className,
  showAll = false,
}: UserAchievementBadgesProps) {
  // Filter to only unlocked achievements
  const unlockedAchievements = achievements.filter(a => a.unlocked);
  
  // If showAll is false, limit the number displayed
  const displayAchievements = showAll 
    ? unlockedAchievements 
    : unlockedAchievements.slice(0, maxDisplay);

  if (displayAchievements.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {displayAchievements.map((achievement) => (
        <AchievementBadge
          key={achievement.type}
          type={achievement.type}
          icon={achievement.icon}
          title={achievement.title}
          description={achievement.description}
          requirement={achievement.requirement}
          unlocked={achievement.unlocked}
          progress={achievement.progress}
          target={achievement.target}
          size={size}
          showProgress={false}
        />
      ))}
      {!showAll && unlockedAchievements.length > maxDisplay && (
        <div className="text-xs text-muted-foreground px-1">
          +{unlockedAchievements.length - maxDisplay}
        </div>
      )}
    </div>
  );
}

