"use client";

import { Home as HomeIcon, Sparkles, User, Clock, CheckCircle, Flame, TrendingUp, Zap } from "lucide-react";

export type TabType = 'all' | 'system' | 'user' | 'expired' | 'settled';
export type QuickFilter = 'none' | 'ending-soon' | 'popular' | 'new';

interface TabNavigationProps {
  activeTab: TabType;
  quickFilter: QuickFilter;
  filteredCounts: {
    system: number;
    user: number;
    expired: number;
    settled: number;
  };
  endingSoonCount: number;
  newWagersCount: number;
  onTabChange: (tab: TabType) => void;
  onQuickFilterChange: (filter: QuickFilter) => void;
  variant?: 'mobile' | 'desktop';
}

export function TabNavigation({
  activeTab,
  quickFilter,
  filteredCounts,
  endingSoonCount,
  newWagersCount,
  onTabChange,
  onQuickFilterChange,
  variant = 'desktop',
}: TabNavigationProps) {
  const isMobile = variant === 'mobile';

  if (isMobile) {
    return (
      <div className="lg:hidden mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onTabChange('all')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
                activeTab === 'all' && quickFilter === 'none'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <HomeIcon className="h-4 w-4" />
              <span className="text-xs font-medium">All</span>
            </button>
            <button
              onClick={() => onTabChange('system')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
                activeTab === 'system'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-medium">System</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                activeTab === 'system' ? 'bg-primary-foreground/20' : 'bg-background'
              }`}>{filteredCounts.system}</span>
            </button>
            <button
              onClick={() => onTabChange('user')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
                activeTab === 'user'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <User className="h-4 w-4" />
              <span className="text-xs font-medium">Community</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                activeTab === 'user' ? 'bg-primary-foreground/20' : 'bg-background'
              }`}>{filteredCounts.user}</span>
            </button>
            <button
              onClick={() => onTabChange('expired')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
                activeTab === 'expired'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Ended</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                activeTab === 'expired' ? 'bg-primary-foreground/20' : 'bg-background'
              }`}>{filteredCounts.expired}</span>
            </button>
            <button
              onClick={() => onTabChange('settled')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap touch-manipulation active:scale-95 flex-shrink-0 ${
                activeTab === 'settled'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Settled</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                activeTab === 'settled' ? 'bg-primary-foreground/20' : 'bg-background'
              }`}>{filteredCounts.settled}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border/50 flex-shrink-0" />

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onQuickFilterChange('ending-soon')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap touch-manipulation active:scale-95 ${
                quickFilter === 'ending-soon'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              <Flame className="h-3 w-3" />
              <span>Soon</span>
              {endingSoonCount > 0 && (
                <span className={`ml-0.5 px-1 py-0.5 rounded text-[10px] font-bold ${
                  quickFilter === 'ending-soon' ? 'bg-white/20' : 'bg-red-500/20'
                }`}>{endingSoonCount}</span>
              )}
            </button>
            <button
              onClick={() => onQuickFilterChange('popular')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap touch-manipulation active:scale-95 ${
                quickFilter === 'popular'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              <span>Popular</span>
            </button>
            <button
              onClick={() => onQuickFilterChange('new')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap touch-manipulation active:scale-95 ${
                quickFilter === 'new'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <Zap className="h-3 w-3" />
              <span>New</span>
              {newWagersCount > 0 && (
                <span className={`ml-0.5 px-1 py-0.5 rounded text-[10px] font-bold ${
                  quickFilter === 'new' ? 'bg-white/20' : 'bg-emerald-500/20'
                }`}>{newWagersCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="flex items-center gap-1.5 bg-muted/30 backdrop-blur-sm rounded-xl p-1.5 border border-border/50 shadow-sm overflow-x-auto scrollbar-hide">
      {/* Main Tabs */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onTabChange('all')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] group ${
            activeTab === 'all' && quickFilter === 'none'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <HomeIcon className="h-4 w-4" />
          <span>All</span>
          {activeTab === 'all' && quickFilter === 'none' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
        </button>
        <button
          onClick={() => onTabChange('system')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] group ${
            activeTab === 'system'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>System</span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'system'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}>
            {filteredCounts.system}
          </span>
          {activeTab === 'system' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
        </button>
        <button
          onClick={() => onTabChange('user')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] group ${
            activeTab === 'user'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <User className="h-4 w-4" />
          <span>Community</span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'user'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}>
            {filteredCounts.user}
          </span>
          {activeTab === 'user' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
        </button>
        <button
          onClick={() => onTabChange('expired')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] group ${
            activeTab === 'expired'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Ended</span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'expired'
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : 'bg-muted text-muted-foreground'
          }`}>
            {filteredCounts.expired}
          </span>
          {activeTab === 'expired' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
        </button>
        <button
          onClick={() => onTabChange('settled')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] group ${
            activeTab === 'settled'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          <span>Settled</span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'settled'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}>
            {filteredCounts.settled}
          </span>
          {activeTab === 'settled' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border/50 flex-shrink-0" />

      {/* Quick Filters */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onQuickFilterChange('ending-soon')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] whitespace-nowrap ${
            quickFilter === 'ending-soon'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
          }`}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>Ending Soon</span>
          {endingSoonCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
              quickFilter === 'ending-soon' ? 'bg-white/20' : 'bg-red-500/20'
            }`}>
              {endingSoonCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onQuickFilterChange('popular')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] whitespace-nowrap ${
            quickFilter === 'popular'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Popular</span>
        </button>
        <button
          onClick={() => onQuickFilterChange('new')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] whitespace-nowrap ${
            quickFilter === 'new'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>New</span>
          {newWagersCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
              quickFilter === 'new' ? 'bg-white/20' : 'bg-emerald-500/20'
            }`}>
              {newWagersCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
