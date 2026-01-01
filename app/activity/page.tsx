"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Users, Trophy, TrendingUp, MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { socialApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { extractErrorMessage } from "@/lib/error-extractor";
import { logger } from "@/lib/logger";
import { PlatformActivities } from "@/components/platform-activities";

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "following">("all");
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchActivities = useCallback(async (reset = false) => {
    if (!user && filter === "following") {
      setLoading(false);
      return;
    }

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const response = await socialApi.getActivityFeed(filter, limit, currentOffset);

      if (response?.data) {
        const newActivities = response.data.activities || [];
        if (reset) {
          setActivities(newActivities);
        } else {
          setActivities((prev) => [...prev, ...newActivities]);
        }
        setHasMore(newActivities.length === limit);
        setOffset(currentOffset + newActivities.length);
      }
    } catch (error: any) {
      logger.error("Error fetching activity feed", error);
      if (reset) {
        const errorMessage = extractErrorMessage(error, "Failed to load activity feed");
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, filter, offset, toast]);

  useEffect(() => {
    fetchActivities(true);
  }, [filter]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "wager_created":
        return <Sparkles className="h-4 w-4 text-primary" />;
      case "wager_joined":
        return <Users className="h-4 w-4 text-blue-500" />;
      case "wager_won":
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case "wager_lost":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "achievement_unlocked":
        return <Trophy className="h-4 w-4 text-purple-500" />;
      case "level_up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header with integrated back button */}
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <BackButton position="inline" />
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Activity Feed</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filter === "following" ? "Activities from users you follow" : "All platform activities"}
                </p>
              </div>
            </div>

            {user && (
              <div className="flex gap-2">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={filter === "following" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("following")}
                >
                  Following
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        {!user && filter === "following" ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Please log in to see activities from users you follow</p>
              <Button onClick={() => router.push("/wagers?login=true")}>Log In</Button>
            </CardContent>
          </Card>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No activities yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Card key={activity.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {activity.user && (
                              <button
                                onClick={() => router.push(`/profile/${activity.user.username || activity.user.id}`)}
                                className="font-medium hover:underline inline-block"
                              >
                                {activity.user.username || activity.user.email || "User"}
                              </button>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {activity.title || activity.description}
                            </span>
                          </div>
                          {activity.wager && (
                            <button
                              onClick={() => router.push(`/wager/${activity.wager.id}`)}
                              className="text-sm text-primary hover:underline mt-1"
                            >
                              {activity.wager.title} →
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <div className="text-center pt-4">
                <Button
                  onClick={() => fetchActivities(false)}
                  disabled={loadingMore}
                  variant="outline"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Platform Activities (All) */}
        {filter === "all" && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Platform Activities</h2>
            <Card>
              <CardContent className="p-4 md:p-6">
                <PlatformActivities />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

