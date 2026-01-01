"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { wagersApi } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import Link from "next/link";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      
      logger.debug("Trending wagers fetched", { count: wagersArray.length, firstWager: wagersArray[0]?.title });
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

  if (loading || authLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trending Wagers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-16" />
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trending Wagers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No trending wagers at the moment. Check back soon!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Trending Wagers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {wagers.map((wager, index) => {
            const wagerLink = wager.short_id ? `/wager/${wager.short_id}` : `/wager/${wager.id}`;
            const totalParticipants = wager.entryCounts?.total || 0;
            const sideAParticipants = wager.entryCounts?.sideA || 0;
            const sideBParticipants = wager.entryCounts?.sideB || 0;
            const isJoined = !!wager.userEntry;
            const userSide = wager.userEntry?.side;

            return (
              <Link
                key={wager.id}
                href={wagerLink}
                className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    {index < 3 ? (
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? "bg-yellow-500 text-yellow-900"
                            : index === 1
                            ? "bg-gray-400 text-gray-900"
                            : "bg-amber-600 text-amber-900"
                        }`}
                      >
                        {index + 1}
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm bg-muted text-muted-foreground">
                        {index + 1}
                      </div>
                    )}
                  </div>

                  {/* Wager Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm sm:text-base line-clamp-2">
                        {wager.title}
                      </h3>
                      {isJoined && (
                        <Badge variant="secondary" className="flex-shrink-0">
                          Joined
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <span className="font-medium">{wager.side_a}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span className="font-medium">{wager.side_b}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatCurrency(wager.amount, (wager.currency as any) || currency)}
                        </span>
                        <span>•</span>
                        <span>{totalParticipants} participants</span>
                        {wager.deadline && (
                          <>
                            <span>•</span>
                            <span>
                              {formatDistanceToNow(new Date(wager.deadline), {
                                addSuffix: true,
                              })}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Progress Bars */}
                      {totalParticipants > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {wager.side_a} ({sideAParticipants})
                            </span>
                            <span className="text-muted-foreground">
                              {wager.side_b} ({sideBParticipants})
                            </span>
                          </div>
                          <div className="flex h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="bg-primary"
                              style={{
                                width: `${(sideAParticipants / totalParticipants) * 100}%`,
                              }}
                            />
                            <div
                              className="bg-secondary"
                              style={{
                                width: `${(sideBParticipants / totalParticipants) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Creator Info */}
                      {wager.creator && (
                        <div className="flex items-center gap-2 pt-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage
                              src={wager.creator.avatar_url || undefined}
                              alt={wager.creator.username || "User"}
                            />
                            <AvatarFallback className="text-[8px]">
                              {wager.creator.username
                                ? wager.creator.username[0].toUpperCase()
                                : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {wager.creator.username || "Anonymous"}
                          </span>
                        </div>
                      )}
                    </div>
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

