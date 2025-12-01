"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { notificationsApi } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

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

interface NotificationsDropdownProps {
  userId: string;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export function NotificationsDropdown({ 
  userId, 
  unreadCount, 
  onUnreadCountChange 
}: NotificationsDropdownProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [open, setOpen] = useState(false);
  
  const fetchingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId || fetchingRef.current) return;
    
    fetchingRef.current = true;
    try {
      setLoading(true);
      const response = await notificationsApi.list({ limit: 10 }); // Only fetch recent 10 for dropdown
      const fetchedNotifications = response.notifications || [];
      setNotifications(fetchedNotifications);
      onUnreadCountChange(response.unreadCount || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [userId, onUnreadCountChange]);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchNotifications();
    }, 1000);
  }, [fetchNotifications]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open && userId) {
      fetchNotifications();
    }
  }, [open, userId, fetchNotifications]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-dropdown:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedRefetch();
        }
      )
      .subscribe();

    // Listen for manual updates
    const handleNotificationUpdate = () => {
      debouncedRefetch();
    };
    window.addEventListener('notifications-updated', handleNotificationUpdate);

    return () => {
      channel.unsubscribe();
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [userId, supabase, debouncedRefetch]);

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      onUnreadCountChange(Math.max(0, unreadCount - 1));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    setMarkingRead(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onUnreadCountChange(0);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      setMarkingRead(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Generate link if not present
    let link = notification.link;
    if (!link) {
      const { generateNotificationLink } = await import('@/lib/notification-links');
      link = generateNotificationLink(notification.type, notification.metadata, notification.link);
    }
    
    // Navigate if link exists
    if (link) {
      router.push(link);
      setOpen(false);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px] border-2 border-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
              disabled={markingRead}
              className="h-7 text-xs"
            >
              {markingRead ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="py-2">
              {notifications.map((notification) => {
                // Generate link if not present (will be computed in handleNotificationClick if needed)
                const link = notification.link;
                const hasMetadata = !!(notification.metadata?.wager_id || notification.metadata?.quiz_id || notification.metadata?.transaction_id || notification.metadata?.reference);
                const clickable = link || hasMetadata;
                
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`flex flex-col items-start gap-1 p-3 min-h-[60px] touch-manipulation ${
                      clickable 
                        ? 'cursor-pointer focus:bg-muted active:bg-muted/80 hover:bg-muted/50' 
                        : 'cursor-default'
                    }`}
                    onClick={() => clickable && handleNotificationClick(notification)}
                    disabled={!clickable}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-sm font-semibold ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                          {clickable && (
                            <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                              Tap to view
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DropdownMenuSeparator />
        <div className="p-2 border-t">
          <Link href="/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-center text-sm min-h-[44px] touch-manipulation">
              View all notifications
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

