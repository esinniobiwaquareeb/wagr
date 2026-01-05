-- Add bot and gamification toggle settings
-- These settings allow admins to enable/disable bots and gamification

-- Get admin user ID (assuming there's at least one admin)
DO $$
DECLARE
  admin_id uuid;
BEGIN
  -- Get first admin user
  SELECT id INTO admin_id
  FROM admins
  LIMIT 1;

  -- If no admin found, create a placeholder (this shouldn't happen in production)
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;

  -- Bot settings
  INSERT INTO platform_settings (id, key, value, category, label, description, data_type, is_public, requires_restart, updated_by, created_at, updated_at)
  VALUES 
    (gen_random_uuid(), 'features.bots.enabled', 'false'::jsonb, 'features', 'Enable Bots', 'Enable automatic bot participation in wagers. Bots will join wagers after 10 minutes if no participants have joined.', 'boolean', FALSE, FALSE, admin_id, NOW(), NOW())
  ON CONFLICT (key) DO UPDATE
    SET 
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = NOW(),
      updated_by = admin_id;

  -- Gamification settings (public so frontend can check if enabled)
  INSERT INTO platform_settings (id, key, value, category, label, description, data_type, is_public, requires_restart, updated_by, created_at, updated_at)
  VALUES 
    (gen_random_uuid(), 'features.gamification.enabled', 'true'::jsonb, 'features', 'Enable Gamification', 'Enable gamification features including XP, levels, achievements, challenges, and streaks.', 'boolean', TRUE, FALSE, admin_id, NOW(), NOW())
  ON CONFLICT (key) DO UPDATE
    SET 
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      is_public = TRUE,
      updated_at = NOW(),
      updated_by = admin_id;

  RAISE NOTICE 'Bot and gamification settings added successfully';
END $$;

