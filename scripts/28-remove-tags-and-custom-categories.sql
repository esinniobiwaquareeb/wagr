-- Remove tags and custom categories from preferences
-- This script removes custom_categories table and removes tags/custom_categories from user_preferences
-- Note: Tags column on wagers table is kept for backward compatibility

-- Drop custom_categories table and all related objects
DROP TABLE IF EXISTS custom_categories CASCADE;

-- Remove tags and custom_categories columns from user_preferences table
ALTER TABLE user_preferences DROP COLUMN IF EXISTS preferred_tags;
ALTER TABLE user_preferences DROP COLUMN IF EXISTS custom_categories;

-- Note: The tags column on wagers table is kept for backward compatibility
-- The category column on wagers is also kept as it's still used for filtering

