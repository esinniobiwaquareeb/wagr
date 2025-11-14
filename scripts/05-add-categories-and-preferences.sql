-- Add categories to wagers and user preferences
-- This enables automated wager creation and user filtering

-- Add category column to wagers
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN DEFAULT false;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS source_data JSONB;

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_categories TEXT[] DEFAULT '{}',
  preferred_tags TEXT[] DEFAULT '{}',
  custom_categories TEXT[] DEFAULT '{}',
  notification_enabled BOOLEAN DEFAULT true,
  notification_types TEXT[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create custom categories table (shared across users)
CREATE TABLE IF NOT EXISTS custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on custom_categories
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;

-- Custom categories policies (public read, authenticated users can create)
CREATE POLICY "public read custom categories" ON custom_categories FOR SELECT USING (true);
CREATE POLICY "authenticated users can create" ON custom_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Enable RLS on user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- User preferences policies
CREATE POLICY "users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Add unique constraint to prevent duplicate entries
-- A user can only have one entry per wager
ALTER TABLE wager_entries 
ADD CONSTRAINT unique_user_wager_entry 
UNIQUE (user_id, wager_id);

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_wagers_category ON wagers(category);
CREATE INDEX IF NOT EXISTS idx_wagers_tags ON wagers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_wagers_system_generated ON wagers(is_system_generated);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_preferences
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

