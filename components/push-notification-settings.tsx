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
    if (!isSupported || !user || isToggling) return;

    setIsToggling(true);
    const previousState = isSubscribed;
    const newState = !isSubscribed;
    
    try {
      if (newState) {
        // Enabling push notifications
        const permission = await requestPushPermission();
        if (permission === 'granted') {
          const subscription = await subscribeToPushNotifications();
          if (subscription) {
            // Save preference to database
            const { error: dbError } = await supabase
              .from('user_preferences')
              .upsert({
                user_id: user.id,
                push_notifications_enabled: true,
              }, {
                onConflict: 'user_id',
              });
            
            if (!dbError) {
              setIsSubscribed(true);
            } else {
              console.error('Error saving preference:', dbError);
              setIsSubscribed(previousState);
            }
          } else {
            // Subscription failed
            setIsSubscribed(previousState);
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
          // Permission denied
          setIsSubscribed(previousState);
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
        
        // Update preference in database regardless of unsubscribe result
        const { error: dbError } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            push_notifications_enabled: false,
          }, {
            onConflict: 'user_id',
          });
        
        if (!dbError) {
          setIsSubscribed(false);
        } else {
          console.error('Error updating preference:', dbError);
          // If unsubscribe succeeded but DB update failed, still update UI
          if (success) {
            setIsSubscribed(false);
          } else {
            setIsSubscribed(previousState);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      // Revert to previous state on error
      setIsSubscribed(previousState);
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
      className="w-full flex items-center justify-between p-3 md:p-3.5 hover:bg-muted rounded-lg transition active:scale-[0.98] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed group min-h-[44px]"
    >
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
        )}
        <span className="font-medium text-sm">
          Push Notifications
        </span>
      </div>
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
      ) : (
        <div
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
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

