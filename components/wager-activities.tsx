"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  MessageSquare,
  Sparkles,
  Trophy,
  CheckCircle2,
  Loader2,
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
}

interface WagerActivitiesProps {
  wagerId: string;
  sideA: string;
  sideB: string;
}

export function WagerActivities({ wagerId, sideA, sideB }: WagerActivitiesProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      // TODO: Create API route /api/wagers/[id]/activities that proxies to NestJS backend
      // For now, fetch from API route (which will need to be created)
      const response = await fetch(`/api/wagers/${wagerId}/activities`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      // Handle both response formats: { success: true, data: { activities: [...] } } or { activities: [...] }
      const activitiesData = data.success && data.data?.activities 
        ? data.data.activities 
        : data.activities || data.data?.activities || [];
      
      setActivities(activitiesData);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  }, [wagerId]);

  useEffect(() => {
    fetchActivities();

    // Poll for updates every 30 seconds (replaces real-time subscriptions)
    const pollInterval = setInterval(() => {
      fetchActivities();
    }, 30000);

    // Listen for custom activity update events
    const handleActivityUpdate = () => {
      fetchActivities();
    };
    window.addEventListener('wager-activity-updated', handleActivityUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('wager-activity-updated', handleActivityUpdate);
    };
  }, [wagerId, fetchActivities]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "joined":
        return <UserPlus className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "left":
        return <UserMinus className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "switched_side":
        return <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "comment":
        return <MessageSquare className="h-4 w-4 text-primary" />;
      case "wager_created":
        return <Sparkles className="h-4 w-4 text-primary" />;
      case "wager_resolved":
        return <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "wager_settled":
        return <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const username = activity.profiles?.username || "Someone";
    const sideName = (side: string) => (side === "a" ? sideA : sideB);

    switch (activity.activity_type) {
      case "joined":
        return (
          <span>
            <span className="font-semibold">{username}</span> joined{" "}
            <span className="font-semibold text-primary">{sideName(activity.activity_data.side)}</span>
          </span>
        );
      case "left":
        return (
          <span>
            <span className="font-semibold">{username}</span> left the wager
          </span>
        );
      case "switched_side":
        return (
          <span>
            <span className="font-semibold">{username}</span> switched from{" "}
            <span className="font-semibold">{sideName(activity.activity_data.from_side)}</span> to{" "}
            <span className="font-semibold text-primary">{sideName(activity.activity_data.to_side)}</span>
          </span>
        );
      case "comment":
        return (
          <span>
            <span className="font-semibold">{username}</span>{" "}
            {activity.activity_data.is_reply ? "replied to a comment" : "commented"}
          </span>
        );
      case "wager_created":
        return (
          <span>
            <span className="font-semibold">{username}</span> created this wager
          </span>
        );
      case "wager_resolved":
        const resolvedSide = activity.activity_data.winning_side?.toLowerCase() || '';
        return (
          <span>
            Wager resolved: <span className="font-semibold text-primary">{resolvedSide ? sideName(resolvedSide) : 'Unknown'}</span> won
          </span>
        );
      case "wager_settled":
        const settledSide = activity.activity_data.winning_side?.toLowerCase() || '';
        return (
          <span>
            Wager settled: <span className="font-semibold text-green-600 dark:text-green-400">{settledSide ? sideName(settledSide) : 'Unknown'}</span> won and winnings distributed
          </span>
        );
      default:
        return <span>{activity.activity_type}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No activities yet</p>
        </div>
      ) : (
        activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition"
          >
            <div className="flex-shrink-0 mt-0.5">{getActivityIcon(activity.activity_type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{getActivityText(activity)}</p>
                  {activity.activity_type === "joined" && activity.activity_data.amount && (
                    <p className="text-xs text-muted-foreground mt-0.5">
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
        ))
      )}
    </div>
  );
}

