-- Add app settings for push notifications to platform_settings table
-- These settings are used by the push notification trigger

-- Add app.url setting
INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public, requires_restart)
VALUES (
  'app.url',
  '"https://wagered.app"'::jsonb,
  'app',
  'App URL',
  'Base URL of the application (used for push notifications and email links)',
  'string',
  false,
  false
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

-- Add app.notification_api_secret setting
INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public, requires_restart)
VALUES (
  'app.notification_api_secret',
  '""'::jsonb, -- Empty by default, should be set via admin panel
  'app',
  'Notification API Secret',
  'Secret key for internal API calls (push notifications, email sending). Leave empty to disable authentication.',
  'string',
  false,
  true -- Requires restart if changed
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

-- Note: After running this script, update the values via the admin panel at /admin/settings
-- or via SQL:
-- UPDATE platform_settings SET value = '"https://wagered.app"'::jsonb WHERE key = 'app.url';
-- UPDATE platform_settings SET value = '"your-secret-key"'::jsonb WHERE key = 'app.notification_api_secret';

