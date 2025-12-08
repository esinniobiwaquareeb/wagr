"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  MessageSquare,
  Sparkles,
  Trophy,
  CheckCircle2,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface Activity {
  id: string;
  wager_id: string;
  user_id: string | null;
  activity_type: string;
  activity_data: Record<string, any>;
  created_at: string;
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  };
  wagers?: {
    id: string;
    title: string;
    side_a: string;
    side_b: string;
    short_id: string | null;
  };
}

export function PlatformActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 50;

  const fetchActivities = useCallback(async (page = 1, append = false) => {
    try {
      setLoadingMore(true);

      const response = await fetch(`/api/wagers/activities?page=${page}&limit=${pageSize}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      
      // Handle response format: { success: true, data: [...], meta: {...} }
      const activitiesData = data.success && Array.isArray(data.data)
        ? data.data
        : data.activities || [];

      if (append) {
        setActivities((prev) => [...prev, ...activitiesData]);
      } else {
        setActivities(activitiesData);
      }

      // Check if there are more pages
      const total = data.meta?.total || 0;
      const currentTotal = append ? activities.length + activitiesData.length : activitiesData.length;
      setHasMore(currentTotal < total);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities(1, false);

    // Poll for updates every 30 seconds (replaces real-time subscriptions)
    const pollInterval = setInterval(() => {
      fetchActivities(1, false);
    }, 30000);

    // Listen for custom activity update events
    const handleActivityUpdate = () => {
      fetchActivities(1, false);
    };
    window.addEventListener('wager-activity-updated', handleActivityUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('wager-activity-updated', handleActivityUpdate);
    };
  }, [fetchActivities]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = Math.floor(activities.length / pageSize) + 1;
      fetchActivities(nextPage, true);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "joined":
        return <UserPlus className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />;
      case "left":
        return <UserMinus className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />;
      case "switched_side":
        return <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
      case "comment":
        return <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />;
      case "wager_created":
        return <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />;
      case "wager_resolved":
        return <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
      case "wager_settled":
        return <Trophy className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />;
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const username = activity.profiles?.username || "Someone";
    const wager = activity.wagers;
    const wagerTitle = wager?.title || "a wager";
    const wagerLink = wager ? `/wager/${wager.short_id || wager.id}` : "#";
    const sideName = (side: string) => {
      if (!wager) return side;
      return side === "a" ? wager.side_a : wager.side_b;
    };

    switch (activity.activity_type) {
      case "joined":
        return (
          <span>
            <span className="font-semibold">{username}</span> joined{" "}
            <Link href={wagerLink} className="font-semibold text-primary hover:underline">
              {wagerTitle}
            </Link>{" "}
            on <span className="font-semibold text-primary">{sideName(activity.activity_data.side)}</span>
          </span>
        );
      case "left":
        return (
          <span>
            <span className="font-semibold">{username}</span> left{" "}
            <Link href={wagerLink} className="font-semibold text-primary hover:underline">
              {wagerTitle}
            </Link>
          </span>
        );
      case "switched_side":
        return (
          <span>
            <span className="font-semibold">{username}</span> switched sides in{" "}
            <Link href={wagerLink} className="font-semibold text-primary hover:underline">
              {wagerTitle}
            </Link>{" "}
            from <span className="font-semibold">{sideName(activity.activity_data.from_side)}</span> to{" "}
            <span className="font-semibold text-primary">{sideName(activity.activity_data.to_side)}</span>
          </span>
        );
      case "comment":
        return (
          <span>
            <span className="font-semibold">{username}</span>{" "}
            {activity.activity_data.is_reply ? "replied to a comment on" : "commented on"}{" "}
            <Link href={wagerLink} className="font-semibold text-primary hover:underline">
              {wagerTitle}
            </Link>
          </span>
        );
      case "wager_created":
        return (
          <span>
            <span className="font-semibold">{username}</span> created{" "}
            <Link href={wagerLink} className="font-semibold text-primary hover:underline">
              {wagerTitle}
            </Link>
          </span>
        );
      case "wager_resolved":
        const resolvedSide = activity.activity_data.winning_side?.toLowerCase() || "";
        return (
          <span>
            <Link href={wagerLink} className="font-semibold text-primary hover:underline">
              {wagerTitle}
            </Link>{" "}
            resolved: <span className="font-semibold text-primary">{resolvedSide ? sideName(resolvedSide) : "Unknown"}</span> won
          </span>
        );
      case "wager_settled":
        const settledSide = activity.activity_data.winning_side?.toLowerCase() || "";
        return (
          <span>
            <Link href={wagerLink} className="font-semibold text-primary hover:underline">
              {wagerTitle}
            </Link>{" "}
            settled: <span className="font-semibold text-green-600 dark:text-green-400">{settledSide ? sideName(settledSide) : "Unknown"}</span> won and winnings distributed
          </span>
        );
      default:
        return <span>{activity.activity_type}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium mb-1">No activities yet</p>
          <p className="text-xs">Activities will appear here as they happen</p>
        </div>
      ) : (
        <>
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition group"
            >
              <div className="flex-shrink-0 mt-0.5">{getActivityIcon(activity.activity_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{getActivityText(activity)}</p>
                    {activity.activity_type === "joined" && activity.activity_data.amount && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Amount: ₦{Number(activity.activity_data.amount).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition active:scale-95 touch-manipulation text-sm font-medium min-h-[44px] disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

