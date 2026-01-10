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
      <Card className="border-border/50">
        <CardHeader className="pb-1 pt-2 px-3 sm:px-4">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span>Trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-4 pb-2">
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-56 sm:w-64">
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (wagers.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-1 pt-2 px-3 sm:px-4">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span>Trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-4 pb-2">
          <p className="text-muted-foreground text-center py-3 text-xs">
            No trending wagers at the moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="px-3 sm:px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-md font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span>Trending</span>
          </CardTitle>
          {wagers.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={scrollLeft}
                disabled={!canScrollLeft}
                className="h-6 w-6 disabled:opacity-30"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={scrollRight}
                disabled={!canScrollRight}
                className="h-6 w-6 disabled:opacity-30"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 sm:px-4">
        <div
          ref={scrollContainerRef}
          className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 scroll-smooth"
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
                className="flex-shrink-0 w-56 sm:w-64 group"
              >
                <div className="bg-card border border-border dark:border-border/80 rounded-lg px-2.5 py-2 h-full hover:border-primary/50 dark:hover:border-primary/60 hover:shadow-md dark:hover:shadow-primary/10 transition-all cursor-pointer active:scale-[0.98] touch-manipulation flex flex-col min-h-[140px]">
                  {/* Rank Badge & Title Row */}
                  <div className="flex items-start justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {index < 3 ? (
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${
                            index === 0
                              ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 dark:text-yellow-950"
                              : index === 1
                              ? "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900 dark:text-gray-950"
                              : "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-900 dark:text-amber-950"
                          }`}
                        >
                          {index === 0 ? <Trophy className="h-2.5 w-2.5" /> : index + 1}
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full flex items-center justify-center font-bold text-[9px] bg-muted text-muted-foreground flex-shrink-0">
                          {index + 1}
                        </div>
                      )}
                      {wager.category?.icon && (
                        <span className="text-sm flex-shrink-0">{wager.category.icon}</span>
                      )}
                      <h3 className="font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors flex-1 min-w-0">
                        {wager.title}
                      </h3>
                    </div>
                    {isJoined && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 flex-shrink-0">
                        Joined
                      </Badge>
                    )}
                  </div>

                  {/* Sides & Progress */}
                  <div className="space-y-1 mb-1.5 flex-1">
                    <div className="flex items-center justify-between text-[10px] gap-1">
                      <span className="font-medium text-foreground truncate flex-1 min-w-0 text-left">{wager.side_a}</span>
                      <span className="text-muted-foreground mx-0.5 flex-shrink-0 text-[9px]">vs</span>
                      <span className="font-medium text-foreground truncate flex-1 min-w-0 text-right">{wager.side_b}</span>
                    </div>

                    {/* Progress Bar */}
                    {totalParticipants > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="bg-primary transition-all"
                            style={{ width: `${sideAPercent}%` }}
                          />
                          <div
                            className="bg-secondary transition-all"
                            style={{ width: `${sideBPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                          <span>{sideAPercent}%</span>
                          <span>{sideBPercent}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-1.5 bg-muted rounded-full" />
                    )}
                  </div>

                  {/* Compact Stats Footer */}
                  <div className="flex items-center justify-between gap-1.5 text-[9px] text-muted-foreground pt-1 border-t border-border/50 dark:border-border/70">
                    <div className="flex items-center gap-0.5 min-w-0">
                      <Users className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{totalParticipants}</span>
                    </div>
                    <div className="flex items-center gap-0.5 min-w-0">
                      <Coins className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {formatCurrency(wager.amount, (wager.currency as any) || currency)}
                      </span>
                    </div>
                    {wager.deadline && (
                      <div className="flex items-center gap-0.5 min-w-0">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {formatDistanceToNow(new Date(wager.deadline), {
                            addSuffix: true,
                          }).replace('about ', '').replace('in ', '')}
                        </span>
                      </div>
                    )}
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

