"use client";

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { 
  isPushNotificationSupported, 
  requestPushPermission, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  getPushSubscription 
} from '@/lib/push-notifications';
import { useAuth } from '@/hooks/use-auth';

export function PushNotificationSettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const checkSubscription = async () => {
      setIsSupported(isPushNotificationSupported());
      
      if (isPushNotificationSupported()) {
        const subscription = await getPushSubscription();
        setIsSubscribed(!!subscription);
      }
      
      setIsLoading(false);
    };

    checkSubscription();
  }, [user]);

  const handleToggle = async () => {
    if (!isSupported || !user) return;

    setIsToggling(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromPushNotifications();
        setIsSubscribed(false);
      } else {
        const permission = await requestPushPermission();
        if (permission === 'granted') {
          const subscription = await subscribeToPushNotifications();
          setIsSubscribed(!!subscription);
        }
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
    } finally {
      setIsToggling(false);
    }
  };

  if (!user || isLoading) {
    return null;
  }

  if (!isSupported) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Push notifications are not supported in this browser.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className="w-full flex items-center justify-between p-2.5 md:p-4 bg-muted/50 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation disabled:opacity-50"
    >
      <div className="flex items-center gap-2 md:gap-3">
        {isSubscribed ? (
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
        ) : (
          <BellOff className="h-4 w-4 md:h-5 md:w-5" />
        )}
        <span className="font-medium text-xs md:text-base">
          Push Notifications
        </span>
      </div>
      {isToggling ? (
        <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
      ) : (
        <div
          className={`relative w-11 h-6 rounded-full transition-colors ${
            isSubscribed ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
      )}
    </button>
  );
}

