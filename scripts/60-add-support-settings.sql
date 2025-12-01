-- Add support settings to platform_settings table
-- These settings control the support information displayed on the contact page

-- Support Email
INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public, requires_restart)
VALUES (
  'support.email',
  '"support@wagr.app"'::jsonb,
  'support',
  'Support Email',
  'Email address displayed on the contact page for user support inquiries',
  'string',
  true,
  false
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

-- Support Phone Number
INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public, requires_restart)
VALUES (
  'support.phone',
  '""'::jsonb,
  'support',
  'Contact Phone Number',
  'Phone number displayed on the contact page for user support inquiries',
  'string',
  true,
  false
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

-- Support Note
INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public, requires_restart)
VALUES (
  'support.note',
  '""'::jsonb,
  'support',
  'Support Note',
  'Additional note or message displayed on the contact page to help users',
  'string',
  true,
  false
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

