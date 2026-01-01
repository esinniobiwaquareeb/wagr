"use client";

import React from "react";

interface IconProps {
  className?: string;
}

export const FirstWagerIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#FFA500" stopOpacity="0.3"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="url(#grad1)" stroke="currentColor" strokeWidth="2"/>
    <path d="M30 50 L45 65 L70 35" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.2"/>
  </svg>
);

export const FirstWinIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.4"/>
        <stop offset="100%" stopColor="#FF8C00" stopOpacity="0.4"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="url(#grad2)" stroke="currentColor" strokeWidth="2"/>
    <path d="M50 20 L60 45 L85 45 L65 60 L70 85 L50 70 L30 85 L35 60 L15 45 L40 45 Z" 
          fill="currentColor" stroke="currentColor" strokeWidth="2" opacity="0.9"/>
  </svg>
);

export const TenWagersIcon = ({ className }: IconProps) => {
  const uniqueId = `ten-wagers-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A90E2" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#357ABD" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${uniqueId})`} stroke="currentColor" strokeWidth="2"/>
      <circle cx="35" cy="35" r="8" fill="currentColor"/>
      <circle cx="65" cy="35" r="8" fill="currentColor"/>
      <circle cx="50" cy="50" r="8" fill="currentColor"/>
      <circle cx="35" cy="65" r="8" fill="currentColor"/>
      <circle cx="65" cy="65" r="8" fill="currentColor"/>
      <path d="M35 35 L65 35 M50 35 L50 50 M50 50 L35 65 M50 50 L65 65" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
};

export const HundredWagersIcon = ({ className }: IconProps) => {
  const uniqueId = `hundred-wagers-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9B59B6" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#8E44AD" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${uniqueId})`} stroke="currentColor" strokeWidth="2"/>
      <path d="M25 50 Q25 30 45 30 Q50 30 50 20 Q50 30 55 30 Q75 30 75 50 Q75 70 55 70 Q50 70 50 80 Q50 70 45 70 Q25 70 25 50 Z" 
            fill="currentColor" opacity="0.8"/>
      <circle cx="50" cy="50" r="12" fill="currentColor"/>
      <circle cx="50" cy="50" r="6" fill={`url(#${uniqueId})`}/>
    </svg>
  );
};

export const BigWinnerIcon = ({ className }: IconProps) => {
  const uniqueId = `big-winner-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#FFA500" stopOpacity="0.4"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${uniqueId})`} stroke="currentColor" strokeWidth="2"/>
      <rect x="25" y="35" width="50" height="35" rx="3" fill="currentColor" opacity="0.9"/>
      <path d="M30 45 L35 50 L30 55 M70 45 L65 50 L70 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="40" cy="52" r="2" fill={`url(#${uniqueId})`}/>
      <circle cx="50" cy="52" r="2" fill={`url(#${uniqueId})`}/>
      <circle cx="60" cy="52" r="2" fill={`url(#${uniqueId})`}/>
      <path d="M35 30 L40 35 M65 30 L60 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
};

export const CreatorIcon = ({ className }: IconProps) => {
  const uniqueId = `creator-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E74C3C" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#C0392B" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${uniqueId})`} stroke="currentColor" strokeWidth="2"/>
      <path d="M50 20 L55 40 L75 40 L60 52 L65 72 L50 60 L35 72 L40 52 L25 40 L45 40 Z" 
            fill="currentColor" opacity="0.9"/>
      <circle cx="50" cy="50" r="8" fill={`url(#${uniqueId})`}/>
      <path d="M50 20 L50 30 M50 60 L50 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
};

export const SocialButterflyIcon = ({ className }: IconProps) => {
  const uniqueId = `social-butterfly-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF69B4" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#FF1493" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${uniqueId})`} stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="50" cy="50" rx="30" ry="20" fill="currentColor" opacity="0.8"/>
      <ellipse cx="50" cy="50" rx="20" ry="30" fill="currentColor" opacity="0.6"/>
      <circle cx="35" cy="40" r="6" fill="currentColor"/>
      <circle cx="65" cy="40" r="6" fill="currentColor"/>
      <circle cx="35" cy="60" r="6" fill="currentColor"/>
      <circle cx="65" cy="60" r="6" fill="currentColor"/>
      <path d="M35 40 Q50 50 65 40 M35 60 Q50 50 65 60" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5"/>
    </svg>
  );
};

export const StreakMasterIcon = ({ className }: IconProps) => {
  const uniqueId = `streak-master-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4500" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#FF6347" stopOpacity="0.4"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${uniqueId})`} stroke="currentColor" strokeWidth="2"/>
      <path d="M50 20 Q45 30 50 40 Q55 30 50 20" fill="currentColor" opacity="0.9"/>
      <path d="M50 40 Q45 50 50 60 Q55 50 50 40" fill="currentColor" opacity="0.9"/>
      <path d="M50 60 Q45 70 50 80 Q55 70 50 60" fill="currentColor" opacity="0.9"/>
      <circle cx="50" cy="50" r="8" fill={`url(#${uniqueId})`}/>
      <path d="M30 50 L20 50 M80 50 L90 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
};

// Map achievement types to icons
export const achievementIcons: Record<string, React.ComponentType<IconProps>> = {
  first_wager: FirstWagerIcon,
  first_win: FirstWinIcon,
  ten_wagers: TenWagersIcon,
  hundred_wagers: HundredWagersIcon,
  big_winner: BigWinnerIcon,
  creator: CreatorIcon,
  social_butterfly: SocialButterflyIcon,
  streak_master: StreakMasterIcon,
};

