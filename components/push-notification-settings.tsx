"use client";

import { useState, useEffect, useMemo } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { 
  isPushNotificationSupported, 
  requestPushPermission, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  getPushSubscription 
} from '@/lib/push-notifications';
import { useAuth } from '@/hooks/use-auth';

export function PushNotificationSettings() {
  const supabase = useMemo(() => createClient(), []);
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
      
      try {
        // Check user preference first
        const { data: preferences, error: prefError } = await supabase
          .from('user_preferences')
          .select('push_notifications_enabled')
          .eq('user_id', user.id)
          .single();

        // If no preferences exist, create one with default false
        if (prefError && prefError.code === 'PGRST116') {
          await supabase
            .from('user_preferences')
            .insert({
              user_id: user.id,
              push_notifications_enabled: false,
            });
        }

        const preferenceEnabled = preferences?.push_notifications_enabled ?? false;
        
        if (isPushNotificationSupported()) {
          // Check actual browser subscription status
          const subscription = await getPushSubscription();
          const hasSubscription = !!subscription;
          
          // Use preference if it exists, otherwise use subscription status
          setIsSubscribed(preferenceEnabled || hasSubscription);
        } else {
          setIsSubscribed(preferenceEnabled);
        }
      } catch (error) {
        console.error('Error checking push notification subscription:', error);
        setIsSubscribed(false);
      }
      
      setIsLoading(false);
    };

    checkSubscription();
  }, [user, supabase]);

  const handleToggle = async () => {
    if (!isSupported || !user) return;

    setIsToggling(true);
    const newState = !isSubscribed;
    
    // Update state immediately for better UX
    setIsSubscribed(newState);
    
    try {
      if (newState) {
        // Enabling push notifications
        const permission = await requestPushPermission();
        if (permission === 'granted') {
          const subscription = await subscribeToPushNotifications();
          if (subscription) {
            // Save preference to database
            await supabase
              .from('user_preferences')
              .upsert({
                user_id: user.id,
                push_notifications_enabled: true,
              }, {
                onConflict: 'user_id',
              });
            setIsSubscribed(true);
          } else {
            setIsSubscribed(false);
          }
        } else {
          // Permission denied
          setIsSubscribed(false);
          await supabase
            .from('user_preferences')
            .upsert({
              user_id: user.id,
              push_notifications_enabled: false,
            }, {
              onConflict: 'user_id',
            });
        }
      } else {
        // Disabling push notifications
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          // Update preference in database
          await supabase
            .from('user_preferences')
            .upsert({
              user_id: user.id,
              push_notifications_enabled: false,
            }, {
              onConflict: 'user_id',
            });
          setIsSubscribed(false);
        } else {
          // If unsubscribe failed, revert state
          setIsSubscribed(true);
        }
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      // Revert state on error
      setIsSubscribed(!newState);
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
      type="button"
      className="w-full flex items-center justify-between p-2.5 md:p-4 bg-muted/50 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
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
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
              isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
      )}
    </button>
  );
}

