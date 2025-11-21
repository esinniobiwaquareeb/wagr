"use client";

interface HowItWorksIllustrationProps {
  step: 1 | 2 | 3 | 4;
  className?: string;
}

export function HowItWorksIllustration({ step, className = "" }: HowItWorksIllustrationProps) {
  const illustrations = {
    1: (
      <svg viewBox="0 0 300 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* User profile */}
        <circle cx="150" cy="80" r="40" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <circle cx="150" cy="70" r="15" fill="currentColor" fillOpacity="0.3" />
        <path d="M 120 110 Q 150 100, 180 110" stroke="currentColor" strokeWidth="2" fill="none" />
        {/* Checkmark */}
        <circle cx="200" cy="50" r="20" fill="currentColor" className="text-primary" />
        <path d="M 192 50 L 198 56 L 208 46" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Arrow */}
        <path d="M 150 140 L 150 180" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M 140 170 L 150 180 L 160 170" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    2: (
      <svg viewBox="0 0 300 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Wallet */}
        <rect x="100" y="60" width="100" height="80" rx="8" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <rect x="110" y="75" width="80" height="15" rx="2" fill="currentColor" fillOpacity="0.2" />
        <rect x="110" y="100" width="80" height="15" rx="2" fill="currentColor" fillOpacity="0.2" />
        {/* Money icon */}
        <circle cx="220" cy="100" r="25" fill="currentColor" fillOpacity="0.2" className="text-primary" />
        <text x="220" y="108" textAnchor="middle" className="text-lg fill-current font-bold text-primary">₦</text>
        {/* Arrow */}
        <path d="M 150 150 L 150 180" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M 140 170 L 150 180 L 160 170" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    3: (
      <svg viewBox="0 0 300 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Target/Bullseye */}
        <circle cx="150" cy="100" r="50" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <circle cx="150" cy="100" r="30" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <circle cx="150" cy="100" r="15" fill="currentColor" fillOpacity="0.3" />
        {/* Yes/No options */}
        <rect x="50" y="50" width="60" height="30" rx="6" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" className="text-primary" />
        <text x="80" y="70" textAnchor="middle" className="text-sm fill-current font-bold text-primary">YES</text>
        <rect x="190" y="50" width="60" height="30" rx="6" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
        <text x="220" y="70" textAnchor="middle" className="text-sm fill-current font-bold">NO</text>
        {/* Arrow */}
        <path d="M 150 160 L 150 180" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M 140 170 L 150 180 L 160 170" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    4: (
      <svg viewBox="0 0 300 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Chart going up */}
        <path d="M 80 150 L 120 120 L 160 100 L 200 80 L 240 60" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
        {/* Data points */}
        {[
          { x: 80, y: 150 },
          { x: 120, y: 120 },
          { x: 160, y: 100 },
          { x: 200, y: 80 },
          { x: 240, y: 60 },
        ].map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r="6" fill="currentColor" className="text-primary" />
        ))}
        {/* Money bag/trophy */}
        <circle cx="250" cy="50" r="20" fill="currentColor" fillOpacity="0.2" className="text-primary" />
        <text x="250" y="58" textAnchor="middle" className="text-lg fill-current font-bold text-primary">₦</text>
        {/* Success checkmark */}
        <circle cx="60" cy="50" r="20" fill="currentColor" className="text-primary" />
        <path d="M 52 50 L 58 56 L 68 46" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return illustrations[step];
}

