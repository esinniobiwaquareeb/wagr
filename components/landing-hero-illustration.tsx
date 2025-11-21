"use client";

export function LandingHeroIllustration() {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-12 sm:mt-16 md:mt-20">
      {/* Main illustration container */}
      <div className="relative aspect-[16/10] w-full">
        {/* Background gradient */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        
        {/* Trading/Wagering Chart Illustration */}
        <svg
          viewBox="0 0 800 500"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grid lines */}
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            </linearGradient>
          </defs>
          
          {/* Grid */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`h-${i}`}
              x1="50"
              y1={100 + i * 100}
              x2="750"
              y2={100 + i * 100}
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.1"
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line
              key={`v-${i}`}
              x1={50 + i * 100}
              y1="50"
              x2={50 + i * 100}
              y2="450"
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.1"
            />
          ))}
          
          {/* Chart area gradient */}
          <path
            d="M 50 350 Q 150 300, 250 280 T 450 250 T 650 200 T 750 150 L 750 450 L 50 450 Z"
            fill="url(#chartGradient)"
          />
          
          {/* Main trend line */}
          <path
            d="M 50 350 Q 150 300, 250 280 T 450 250 T 650 200 T 750 150"
            stroke="url(#lineGradient)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Data points */}
          {[
            { x: 50, y: 350 },
            { x: 150, y: 300 },
            { x: 250, y: 280 },
            { x: 350, y: 260 },
            { x: 450, y: 250 },
            { x: 550, y: 220 },
            { x: 650, y: 200 },
            { x: 750, y: 150 },
          ].map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="currentColor"
                fillOpacity="0.8"
                className="animate-pulse text-primary"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill="currentColor"
                fillOpacity="0.2"
                className="animate-ping text-primary"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            </g>
          ))}
          
          {/* Floating coins/money icons */}
          <g className="animate-bounce text-primary" style={{ animationDuration: '3s', animationDelay: '0s' }}>
            <circle cx="200" cy="100" r="20" fill="currentColor" fillOpacity="0.1" />
            <text x="200" y="107" textAnchor="middle" className="text-xs fill-current font-bold">₦</text>
          </g>
          <g className="animate-bounce text-primary" style={{ animationDuration: '3s', animationDelay: '1s' }}>
            <circle cx="500" cy="80" r="20" fill="currentColor" fillOpacity="0.1" />
            <text x="500" y="87" textAnchor="middle" className="text-xs fill-current font-bold">₦</text>
          </g>
          <g className="animate-bounce text-primary" style={{ animationDuration: '3s', animationDelay: '2s' }}>
            <circle cx="650" cy="120" r="20" fill="currentColor" fillOpacity="0.1" />
            <text x="650" y="127" textAnchor="middle" className="text-xs fill-current font-bold">₦</text>
          </g>
        </svg>
        
        {/* Overlay elements - Market categories icons */}
        <div className="absolute top-4 left-4 flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <span className="text-xs font-semibold text-primary">Sports</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <span className="text-xs font-semibold text-primary">Politics</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <span className="text-xs font-semibold text-primary">Entertainment</span>
          </div>
        </div>
        
        {/* Success indicator */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">Live Markets</span>
        </div>
      </div>
    </div>
  );
}

