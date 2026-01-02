"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { wagersApi } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, Users, Coins, Clock, ChevronRight, Trophy, ChevronLeft } from "lucide-react";
import { logger } from "@/lib/logger";
import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface TrendingWager {
  id: string;
  short_id: string | null;
  title: string;
  side_a: string;
  side_b: string;
  amount: number;
  currency: string;
  deadline: string;
  status: string;
  entryCounts?: {
    sideA: number;
    sideB: number;
    total: number;
  };
  userEntry?: {
    id: string;
    side: string;
    amount: number;
  } | null;
  creator?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
  category?: {
    id: string;
    slug: string;
    label: string;
    icon: string | null;
  };
}

export function TrendingWagers() {
  const { user, loading: authLoading } = useAuth();
  const [wagers, setWagers] = useState<TrendingWager[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currency = DEFAULT_CURRENCY;

  const fetchTrendingWagers = useCallback(async () => {
    try {
      setLoading(true);
      // apiGet extracts response.data, so we get the array directly
      const wagersData = await wagersApi.getTrending(10);
      
      // Handle both array and object with data property
      let wagersArray: TrendingWager[] = [];
      if (Array.isArray(wagersData)) {
        wagersArray = wagersData;
      } else if (wagersData && typeof wagersData === 'object') {
        const dataObj = wagersData as any;
        if ('data' in dataObj && Array.isArray(dataObj.data)) {
          wagersArray = dataObj.data;
        }
      }
      
      setWagers(wagersArray);
    } catch (error) {
      logger.error("Failed to fetch trending wagers", error);
      setWagers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrendingWagers();
  }, [fetchTrendingWagers]);

  // Check scroll position and update button states
  const checkScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10); // 10px threshold
  }, []);

  // Scroll functions
  const scrollLeft = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: -320, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: 320, behavior: 'smooth' });
  }, []);

  // Update scroll button states on scroll and resize
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollButtons();
    container.addEventListener('scroll', checkScrollButtons);
    window.addEventListener('resize', checkScrollButtons);

    return () => {
      container.removeEventListener('scroll', checkScrollButtons);
      window.removeEventListener('resize', checkScrollButtons);
    };
  }, [wagers, checkScrollButtons]);

  if (loading || authLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Trending Wagers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-64 sm:w-72">
                <Skeleton className="h-48 sm:h-52 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (wagers.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Trending Wagers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm sm:text-base">
            No trending wagers at the moment. Check back soon!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Trending Wagers
          </CardTitle>
          {wagers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={scrollLeft}
                disabled={!canScrollLeft}
                className="h-7 w-7 sm:h-8 sm:w-8 disabled:opacity-30"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={scrollRight}
                disabled={!canScrollRight}
                className="h-7 w-7 sm:h-8 sm:w-8 disabled:opacity-30"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          ref={scrollContainerRef}
          className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 scroll-smooth"
          style={{ scrollBehavior: 'smooth' }}
        >
          {wagers.map((wager, index) => {
            const wagerLink = wager.short_id ? `/wager/${wager.short_id}` : `/wager/${wager.id}`;
            const totalParticipants = wager.entryCounts?.total || 0;
            const sideAParticipants = wager.entryCounts?.sideA || 0;
            const sideBParticipants = wager.entryCounts?.sideB || 0;
            const isJoined = !!wager.userEntry;
            const sideAPercent = totalParticipants > 0 ? Math.round((sideAParticipants / totalParticipants) * 100) : 0;
            const sideBPercent = totalParticipants > 0 ? Math.round((sideBParticipants / totalParticipants) * 100) : 0;

            return (
              <Link
                key={wager.id}
                href={wagerLink}
                className="flex-shrink-0 w-64 sm:w-72 group"
              >
                <div className="bg-card border border-border rounded-xl p-3 sm:p-4 h-full hover:border-primary hover:shadow-lg transition-all cursor-pointer active:scale-[0.98] touch-manipulation flex flex-col min-h-[200px] sm:min-h-[220px]">
                  {/* Rank Badge */}
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {index < 3 ? (
                        <div
                          className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs ${
                            index === 0
                              ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-md"
                              : index === 1
                              ? "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900 shadow-md"
                              : "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-900 shadow-md"
                          }`}
                        >
                          {index === 0 ? <Trophy className="h-3 w-3 sm:h-4 sm:w-4" /> : index + 1}
                        </div>
                      ) : (
                        <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs bg-muted text-muted-foreground">
                          {index + 1}
                        </div>
                      )}
                      {wager.category?.icon && (
                        <span className="text-base sm:text-lg">{wager.category.icon}</span>
                      )}
                    </div>
                    {isJoined && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                        Joined
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2 group-hover:text-primary transition-colors min-h-[2.25rem] sm:min-h-[2.5rem] leading-tight">
                    {wager.title}
                  </h3>

                  {/* Sides */}
                  <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3 flex-1">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs gap-1">
                      <span className="font-medium text-foreground truncate flex-1 min-w-0">{wager.side_a}</span>
                      <span className="text-muted-foreground mx-1 flex-shrink-0">vs</span>
                      <span className="font-medium text-foreground truncate flex-1 min-w-0 text-right">{wager.side_b}</span>
                    </div>

                    {/* Progress Bars */}
                    {totalParticipants > 0 ? (
                      <div className="space-y-1">
                        <div className="flex h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="bg-primary transition-all"
                            style={{ width: `${sideAPercent}%` }}
                          />
                          <div
                            className="bg-secondary transition-all"
                            style={{ width: `${sideBPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground">
                          <span className="font-medium">{sideAPercent}%</span>
                          <span className="font-medium">{sideBPercent}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-1.5 sm:h-2 bg-muted rounded-full" />
                    )}
                  </div>

                  {/* Stats Footer */}
                  <div className="flex items-center justify-between gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground pt-2 sm:pt-3 border-t border-border">
                    <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
                      <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                      <span className="font-medium truncate">{totalParticipants}</span>
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
                      <Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                      <span className="font-medium truncate text-[9px] sm:text-[10px]">
                        {formatCurrency(wager.amount, (wager.currency as any) || currency)}
                      </span>
                    </div>
                    {wager.deadline && (
                      <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                        <span className="font-medium truncate text-[9px] sm:text-[10px]">
                          {formatDistanceToNow(new Date(wager.deadline), {
                            addSuffix: true,
                          }).replace('about ', '').replace('in ', '')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* View Arrow */}
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border flex items-center justify-end">
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

