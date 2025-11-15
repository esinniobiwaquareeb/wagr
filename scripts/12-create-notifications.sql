-- Create notifications system
-- This enables users to receive notifications about wager events

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_wager', 'wager_resolved', 'wager_ending', 'balance_update', 'wager_joined', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- URL to related page (e.g., /wager/{id})
  read BOOLEAN DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata JSONB -- Additional data like wager_id, amount, etc.
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "system can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- System can create notifications for any user

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_id_param uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE notifications 
  SET read = true 
  WHERE user_id = user_id_param AND read = false;
END; $$;

-- Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_id_param uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM notifications
  WHERE user_id = user_id_param AND read = false;
  RETURN count_result;
END; $$;

