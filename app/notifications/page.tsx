"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow, format } from "date-fns";
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { notificationsApi } from "@/lib/api-client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
  metadata: Record<string, any> | null;
}

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth({
    requireAuth: true,
    redirectTo: "/wagers?login=true"
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await notificationsApi.list({ limit: 100 });
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load notifications";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchNotifications();

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    } else if (!user && !authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchNotifications, supabase]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      await notificationsApi.markRead(notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Trigger notification update event for sidebar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications-updated'));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0 || !user) return;
    
    setMarkingRead(true);
    try {
      await notificationsApi.markAllRead();

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      // Trigger notification update event for sidebar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications-updated'));
      }
      
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
    } finally {
      setMarkingRead(false);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;
    
    try {
      await notificationsApi.delete(notificationId);

      const deleted = notifications.find(n => n.id === notificationId);
      if (deleted && !deleted.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Trigger notification update event for sidebar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications-updated'));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_wager":
        return "🎲";
      case "wager_resolved":
        return "✅";
      case "wager_ending":
        return "⏰";
      case "balance_update":
        return "💰";
      case "wager_joined":
        return "👥";
      default:
        return "🔔";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "new_wager":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
      case "wager_resolved":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
      case "wager_ending":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
      case "balance_update":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-4xl mx-auto p-3 md:p-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-4xl mx-auto p-3 md:p-6 text-center py-12">
          <p className="text-muted-foreground">Please log in to view notifications</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className="mb-3 md:mb-4">
          <BackButton fallbackHref="/wagers" />
        </div>
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
            <div>
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2 flex items-center gap-2">
                Notifications
              </h1>
              <p className="text-xs md:text-base text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up!'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingRead}
                className="px-3 md:px-4 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition active:scale-[0.98] touch-manipulation text-xs md:text-sm flex items-center gap-2 whitespace-nowrap"
              >
                <CheckCheck className="h-4 w-4" />
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No notifications</h3>
            <p className="text-sm text-muted-foreground">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-card border-2 rounded-lg p-3 md:p-4 transition-all ${
                  notification.read
                    ? "border-border opacity-75"
                    : "border-primary/50 bg-primary/5 shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3 md:gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center text-xl md:text-2xl ${getNotificationColor(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`font-semibold text-sm md:text-base ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground mb-2 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {notification.link && (
                          <Link
                            href={notification.link}
                            onClick={() => markAsRead(notification.id)}
                            className="text-[10px] md:text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1.5 hover:bg-muted rounded transition active:scale-95 touch-manipulation"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1.5 hover:bg-destructive/10 rounded transition active:scale-95 touch-manipulation"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

