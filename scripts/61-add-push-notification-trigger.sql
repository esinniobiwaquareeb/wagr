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
  headers_json jsonb;
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

  -- Get configuration from platform_settings table
  -- Value is stored as JSONB, so we need to extract the string value
  BEGIN
    SELECT 
      CASE 
        WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
        ELSE value::text
      END INTO app_url
    FROM platform_settings
    WHERE key = 'app.url'
    LIMIT 1;
    
    -- Remove surrounding quotes if present (JSONB string values include quotes)
    IF app_url IS NOT NULL AND app_url LIKE '"%"' THEN
      app_url := substring(app_url from 2 for length(app_url) - 2);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      app_url := NULL;
  END;

  -- If not found in platform_settings, try database setting as fallback
  IF app_url IS NULL OR app_url = '' THEN
    BEGIN
      app_url := current_setting('app.settings.app_url', true);
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
  
  -- Get API secret from platform_settings
  BEGIN
    SELECT 
      CASE 
        WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
        ELSE value::text
      END INTO api_secret
    FROM platform_settings
    WHERE key = 'app.notification_api_secret'
    LIMIT 1;
    
    -- Remove surrounding quotes if present
    IF api_secret IS NOT NULL AND api_secret LIKE '"%"' THEN
      api_secret := substring(api_secret from 2 for length(api_secret) - 2);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      api_secret := NULL;
  END;

  -- If not found in platform_settings, try database setting as fallback
  IF api_secret IS NULL OR api_secret = '' THEN
    BEGIN
      api_secret := current_setting('app.settings.notification_api_secret', true);
    EXCEPTION
      WHEN OTHERS THEN
        api_secret := NULL;
    END;
  END IF;
  
  -- Try to use pg_net extension if available
  -- Note: This requires pg_net extension to be enabled in Supabase
  IF push_url IS NOT NULL AND push_url != '' THEN
    BEGIN
      -- Check if pg_net extension is available
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        BEGIN
          -- Build headers
          headers_json := jsonb_build_object('Content-Type', 'application/json');
          
          -- Add Authorization header if secret is provided
          IF api_secret IS NOT NULL AND api_secret != '' AND api_secret != '""' THEN
            headers_json := headers_json || jsonb_build_object('Authorization', 'Bearer ' || api_secret);
          END IF;
          
          -- Use pg_net to call push notification API
          PERFORM net.http_post(
            url := push_url,
            headers := headers_json,
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
        EXCEPTION
          WHEN OTHERS THEN
            -- Log error but don't fail the notification insert
            RAISE WARNING 'Failed to send push notification: %', SQLERRM;
        END;
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
-- 2. Set app.url in platform_settings table (via admin panel or SQL):
--    INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public)
--    VALUES ('app.url', '"https://wagered.app"', 'app', 'App URL', 'Base URL of the application', 'string', false)
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- 3. Set app.notification_api_secret in platform_settings table:
--    INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public)
--    VALUES ('app.notification_api_secret', '"your-secret-key"', 'app', 'Notification API Secret', 'Secret key for internal API calls', 'string', false)
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- Alternatively, if pg_net is not available, push notifications will only work when
-- notifications are created via the createNotification() function in application code.

