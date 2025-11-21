-- Add push_notifications_enabled to user_preferences table
ALTER TABLE user_preferences 
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT false;

