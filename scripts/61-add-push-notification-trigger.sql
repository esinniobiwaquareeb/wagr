-- Add trigger to send push notifications when notifications are inserted
-- This ensures push notifications are sent even when notifications are created by database triggers

-- Function to trigger push notification when notification is created
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  push_url TEXT;
  api_secret TEXT;
  app_url TEXT;
  push_prefs_enabled BOOLEAN;
  notif_prefs_enabled BOOLEAN;
BEGIN
  -- Check user preferences first (push notifications are non-critical, so we can skip if prefs check fails)
  BEGIN
    SELECT 
      COALESCE(push_notifications_enabled, true),
      COALESCE(notification_enabled, true)
    INTO push_prefs_enabled, notif_prefs_enabled
    FROM user_preferences
    WHERE user_id = NEW.user_id
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      -- If preferences check fails, default to enabled (fail open)
      push_prefs_enabled := true;
      notif_prefs_enabled := true;
  END;

  -- Skip if push notifications or all notifications are disabled for this user
  IF push_prefs_enabled = false OR notif_prefs_enabled = false THEN
    RETURN NEW;
  END IF;

  -- Get configuration from environment or settings
  BEGIN
    app_url := current_setting('app.settings.app_url', true);
  EXCEPTION
    WHEN OTHERS THEN
      app_url := NULL;
  END;

  IF app_url IS NULL OR app_url = '' THEN
    -- Try to get from NEXT_PUBLIC_APP_URL if available
    BEGIN
      app_url := current_setting('app.settings.next_public_app_url', true);
    EXCEPTION
      WHEN OTHERS THEN
        app_url := NULL;
    END;
  END IF;

  -- Default to localhost if not configured (for development)
  IF app_url IS NULL OR app_url = '' THEN
    app_url := 'http://localhost:3000';
  END IF;

  push_url := app_url || '/api/push/send';
  
  BEGIN
    api_secret := current_setting('app.settings.notification_api_secret', true);
  EXCEPTION
    WHEN OTHERS THEN
      api_secret := NULL;
  END;
  
  -- Try to use pg_net extension if available
  -- Note: This requires pg_net extension to be enabled in Supabase
  IF push_url IS NOT NULL AND push_url != '' THEN
    BEGIN
      -- Check if pg_net extension is available
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        -- Use pg_net to call push notification API
        PERFORM net.http_post(
          url := push_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            CASE WHEN api_secret IS NOT NULL AND api_secret != '' 
              THEN 'Authorization' 
              ELSE NULL 
            END,
            CASE WHEN api_secret IS NOT NULL AND api_secret != '' 
              THEN 'Bearer ' || api_secret 
              ELSE NULL 
            END
          ),
          body := jsonb_build_object(
            'user_id', NEW.user_id,
            'title', NEW.title,
            'body', NEW.message,
            'url', COALESCE(NEW.link, '/'),
            'data', jsonb_build_object(
              'notification_id', NEW.id,
              'type', NEW.type,
              'metadata', COALESCE(NEW.metadata, '{}'::jsonb)
            )
          )
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't fail the notification insert
        -- Push notifications are non-critical
        RAISE WARNING 'Failed to trigger push notification (pg_net may not be available): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS trigger_send_push_on_notification_insert ON notifications;
CREATE TRIGGER trigger_send_push_on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_push_notification();

-- Note: This trigger will fire for ALL notification inserts, including those from:
-- 1. Database triggers (wager resolved, wager joined, etc.)
-- 2. Application code using createNotification()
-- 3. Direct inserts into notifications table
--
-- The trigger checks user preferences before attempting to send push notifications.
-- If pg_net extension is not available, the trigger will silently skip (non-critical).
--
-- IMPORTANT: For this to work, you need to:
-- 1. Enable pg_net extension in Supabase: CREATE EXTENSION IF NOT EXISTS pg_net;
-- 2. Set app.settings.app_url in Supabase: ALTER DATABASE postgres SET app.settings.app_url = 'https://your-app-url.com';
-- 3. Set app.settings.notification_api_secret: ALTER DATABASE postgres SET app.settings.notification_api_secret = 'your-secret';
--
-- Alternatively, if pg_net is not available, push notifications will only work when
-- notifications are created via the createNotification() function in application code.

