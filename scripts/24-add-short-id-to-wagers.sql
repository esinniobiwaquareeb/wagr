-- Add short_id column to wagers table
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wagers_short_id ON wagers(short_id);

-- Function to generate a short ID from UUID
-- Uses the first 6 characters of the UUID (hex) for a short, unique identifier
CREATE OR REPLACE FUNCTION generate_short_id()
RETURNS TEXT AS $$
DECLARE
  new_short_id TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric ID
    -- Using random() to create a unique short ID
    new_short_id := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    -- Check if it already exists
    SELECT COUNT(*) INTO exists_check
    FROM wagers
    WHERE short_id = new_short_id;
    
    -- If it doesn't exist, we're done
    EXIT WHEN exists_check = 0;
  END LOOP;
  
  RETURN new_short_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate short_id for new wagers
CREATE OR REPLACE FUNCTION set_wager_short_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.short_id IS NULL OR NEW.short_id = '' THEN
    NEW.short_id := generate_short_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_wager_short_id ON wagers;
CREATE TRIGGER trigger_set_wager_short_id
  BEFORE INSERT ON wagers
  FOR EACH ROW
  EXECUTE FUNCTION set_wager_short_id();

-- Generate short_ids for existing wagers that don't have one
DO $$
DECLARE
  wager_record RECORD;
  new_short_id TEXT;
  exists_check INTEGER;
BEGIN
  FOR wager_record IN SELECT id FROM wagers WHERE short_id IS NULL OR short_id = '' LOOP
    LOOP
      new_short_id := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
      
      SELECT COUNT(*) INTO exists_check
      FROM wagers
      WHERE short_id = new_short_id;
      
      EXIT WHEN exists_check = 0;
    END LOOP;
    
    UPDATE wagers
    SET short_id = new_short_id
    WHERE id = wager_record.id;
  END LOOP;
END $$;

