"use client";

interface MarketCategoryIllustrationProps {
  category: "sports" | "politics" | "entertainment" | "crypto" | "general";
  className?: string;
}

export function MarketCategoryIllustration({ category, className = "" }: MarketCategoryIllustrationProps) {
  const illustrations = {
    sports: (
      <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Football/Soccer ball */}
        <circle cx="100" cy="100" r="60" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <path d="M 100 40 Q 120 60, 140 100 Q 120 140, 100 160 Q 80 140, 60 100 Q 80 60, 100 40" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M 100 40 L 100 160 M 60 100 L 140 100" stroke="currentColor" strokeWidth="2" />
        {/* Trophy */}
        <path d="M 80 120 L 80 140 L 120 140 L 120 120 M 70 120 L 130 120 M 100 120 L 100 100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="15" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
    politics: (
      <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Government building */}
        <rect x="60" y="80" width="80" height="100" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <rect x="70" y="100" width="20" height="30" fill="currentColor" fillOpacity="0.2" />
        <rect x="110" y="100" width="20" height="30" fill="currentColor" fillOpacity="0.2" />
        <polygon points="60,80 100,40 140,80" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
        {/* Flag */}
        <rect x="140" y="60" width="30" height="40" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <line x1="140" y1="60" x2="140" y2="100" stroke="currentColor" strokeWidth="3" />
      </svg>
    ),
    entertainment: (
      <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Film/movie reel */}
        <circle cx="100" cy="100" r="50" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <circle cx="100" cy="100" r="30" fill="currentColor" fillOpacity="0.2" />
        <rect x="50" y="90" width="100" height="20" fill="currentColor" fillOpacity="0.3" />
        {/* Star */}
        <path d="M 100 50 L 105 65 L 120 65 L 108 75 L 113 90 L 100 80 L 87 90 L 92 75 L 80 65 L 95 65 Z" fill="currentColor" fillOpacity="0.4" />
        {/* Music note */}
        <path d="M 120 120 Q 130 115, 135 125 Q 130 130, 125 125" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
        <line x1="125" y1="125" x2="125" y2="150" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    crypto: (
      <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bitcoin/Coin */}
        <circle cx="100" cy="100" r="50" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <text x="100" y="110" textAnchor="middle" className="text-4xl fill-current font-bold">₿</text>
        {/* Chart lines */}
        <path d="M 50 150 Q 75 130, 100 140 T 150 120" stroke="currentColor" strokeWidth="2" fill="none" strokeOpacity="0.5" />
        <circle cx="50" cy="150" r="3" fill="currentColor" />
        <circle cx="150" cy="120" r="3" fill="currentColor" />
      </svg>
    ),
    general: (
      <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Trending arrow */}
        <path d="M 50 150 L 100 100 L 130 130 L 150 80" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="150" r="5" fill="currentColor" />
        <circle cx="150" cy="80" r="5" fill="currentColor" />
        {/* Market indicators */}
        <rect x="60" y="140" width="8" height="20" fill="currentColor" fillOpacity="0.3" />
        <rect x="75" y="130" width="8" height="30" fill="currentColor" fillOpacity="0.3" />
        <rect x="90" y="120" width="8" height="40" fill="currentColor" fillOpacity="0.3" />
        <rect x="105" y="110" width="8" height="50" fill="currentColor" fillOpacity="0.3" />
        <rect x="120" y="100" width="8" height="60" fill="currentColor" fillOpacity="0.3" />
        <rect x="135" y="90" width="8" height="70" fill="currentColor" fillOpacity="0.3" />
      </svg>
    ),
  };

  return illustrations[category] || illustrations.general;
}

