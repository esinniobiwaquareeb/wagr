-- Add comments and activities system for wagers
-- This enables real-time discussions and activity tracking

-- Create wager_comments table
CREATE TABLE IF NOT EXISTS wager_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id uuid NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES wager_comments(id) ON DELETE CASCADE, -- For replies
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wager_activities table
CREATE TABLE IF NOT EXISTS wager_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id uuid NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type text NOT NULL, -- 'joined', 'left', 'switched_side', 'comment', 'wager_created', 'wager_resolved', 'wager_settled'
  activity_data jsonb DEFAULT '{}', -- Additional data like side, amount, etc.
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wager_comments_wager_id ON wager_comments(wager_id);
CREATE INDEX IF NOT EXISTS idx_wager_comments_parent_id ON wager_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_wager_comments_created_at ON wager_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wager_activities_wager_id ON wager_activities(wager_id);
CREATE INDEX IF NOT EXISTS idx_wager_activities_created_at ON wager_activities(created_at DESC);

-- Enable RLS
ALTER TABLE wager_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wager_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "public read comments" ON wager_comments
  FOR SELECT USING (true);

CREATE POLICY "authenticated users can insert comments" ON wager_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "users can update own comments" ON wager_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users can delete own comments" ON wager_comments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for activities (public read, system insert)
CREATE POLICY "public read activities" ON wager_activities
  FOR SELECT USING (true);

CREATE POLICY "system can insert activities" ON wager_activities
  FOR INSERT WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_wager_comments_updated_at
  BEFORE UPDATE ON wager_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_updated_at();

-- Function to create activity when user joins wager
CREATE OR REPLACE FUNCTION create_join_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wager_activities (wager_id, user_id, activity_type, activity_data)
  VALUES (
    NEW.wager_id,
    NEW.user_id,
    'joined',
    jsonb_build_object('side', NEW.side, 'amount', NEW.amount)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create activity on wager entry insert
CREATE TRIGGER create_join_activity_trigger
  AFTER INSERT ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION create_join_activity();

-- Function to create activity when user leaves wager
CREATE OR REPLACE FUNCTION create_leave_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wager_activities (wager_id, user_id, activity_type, activity_data)
  VALUES (
    OLD.wager_id,
    OLD.user_id,
    'left',
    jsonb_build_object('side', OLD.side, 'amount', OLD.amount)
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create activity on wager entry delete
CREATE TRIGGER create_leave_activity_trigger
  AFTER DELETE ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION create_leave_activity();

-- Function to create activity when user switches sides
CREATE OR REPLACE FUNCTION create_switch_side_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.side != NEW.side THEN
    INSERT INTO wager_activities (wager_id, user_id, activity_type, activity_data)
    VALUES (
      NEW.wager_id,
      NEW.user_id,
      'switched_side',
      jsonb_build_object('from_side', OLD.side, 'to_side', NEW.side, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create activity on wager entry update (side change)
CREATE TRIGGER create_switch_side_activity_trigger
  AFTER UPDATE ON wager_entries
  FOR EACH ROW
  WHEN (OLD.side IS DISTINCT FROM NEW.side)
  EXECUTE FUNCTION create_switch_side_activity();

-- Function to create activity when comment is created
CREATE OR REPLACE FUNCTION create_comment_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wager_activities (wager_id, user_id, activity_type, activity_data)
  VALUES (
    NEW.wager_id,
    NEW.user_id,
    'comment',
    jsonb_build_object('comment_id', NEW.id, 'is_reply', NEW.parent_id IS NOT NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create activity on comment insert
CREATE TRIGGER create_comment_activity_trigger
  AFTER INSERT ON wager_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_activity();

-- Function to create activity when wager status changes
CREATE OR REPLACE FUNCTION create_wager_status_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create activity if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'RESOLVED' THEN
      INSERT INTO wager_activities (wager_id, user_id, activity_type, activity_data)
      VALUES (
        NEW.id,
        NULL, -- System activity
        'wager_resolved',
        jsonb_build_object('winning_side', NEW.winning_side)
      );
    ELSIF NEW.status = 'SETTLED' THEN
      INSERT INTO wager_activities (wager_id, user_id, activity_type, activity_data)
      VALUES (
        NEW.id,
        NULL, -- System activity
        'wager_settled',
        jsonb_build_object('winning_side', NEW.winning_side)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create activity on wager status update
CREATE TRIGGER create_wager_status_activity_trigger
  AFTER UPDATE ON wagers
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION create_wager_status_activity();

-- Function to create activity when wager is created
CREATE OR REPLACE FUNCTION create_wager_created_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wager_activities (wager_id, user_id, activity_type, activity_data)
  VALUES (
    NEW.id,
    NEW.creator_id,
    'wager_created',
    jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create activity on wager insert
CREATE TRIGGER create_wager_created_activity_trigger
  AFTER INSERT ON wagers
  FOR EACH ROW
  EXECUTE FUNCTION create_wager_created_activity();

