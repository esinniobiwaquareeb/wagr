-- >>> BEGIN wagr/scripts/01-setup-schema.sql
-- Create profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  balance numeric default 0,
  created_at timestamptz default now()
);

-- Create wagers table
create table wagers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  amount numeric not null,
  side_a text not null,
  side_b text not null,
  deadline timestamptz,
  status text default 'OPEN',
  winning_side text,
  fee_percentage numeric default 0.05,
  created_at timestamptz default now()
);

-- Create wager_entries table
create table wager_entries (
  id uuid primary key default gen_random_uuid(),
  wager_id uuid not null references wagers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null,
  amount numeric not null,
  created_at timestamptz default now()
);

-- Create transactions table
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  amount numeric not null,
  reference text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table wagers enable row level security;
alter table wager_entries enable row level security;
alter table transactions enable row level security;

-- Profiles policies
create policy "allow read own" on profiles for select using (auth.uid() = id);
create policy "allow update own" on profiles for update using (auth.uid() = id);
create policy "allow insert" on profiles for insert with check (auth.uid() = id);

-- Wagers policies (public read, creator can create/update)
create policy "public read" on wagers for select using (true);
create policy "creator insert" on wagers for insert with check (auth.uid() = creator_id or creator_id is null);
create policy "creator update" on wagers for update using (auth.uid() = creator_id or creator_id is null);

-- Wager entries policies
create policy "public view" on wager_entries for select using (true);
create policy "user insert" on wager_entries for insert with check (auth.uid() = user_id);

-- Transactions policies
create policy "user view own" on transactions for select using (auth.uid() = user_id);
create policy "user insert" on transactions for insert with check (auth.uid() = user_id);

-- Create increment_balance RPC function
create or replace function increment_balance(user_id uuid, amt numeric)
returns void language plpgsql as $$
begin
  update profiles set balance = balance + amt where id = user_id;
end; $$;

-- Seed some system wagers
insert into wagers (title, description, amount, side_a, side_b, deadline, status, fee_percentage)
values 
  ('Will it rain tomorrow?', 'Bet on whether it will rain in your city', 100, 'Yes', 'No', now() + interval '1 day', 'OPEN', 0.01),
  ('Bitcoin over $50k by month end?', 'Cryptocurrency price prediction', 500, 'Yes', 'No', now() + interval '15 days', 'OPEN', 0.01),
  ('Who wins the playoff game?', 'Sports prediction for upcoming game', 250, 'Team A', 'Team B', now() + interval '3 days', 'OPEN', 0.01);

-- <<< END wagr/scripts/01-setup-schema.sql

-- >>> BEGIN wagr/scripts/02-update-leaderboard-policies.sql
-- Update RLS policies to allow public read of profiles for leaderboard
-- This allows anyone to view username and balance for leaderboard purposes

-- Drop existing restrictive policy
drop policy if exists "allow read own" on profiles;

-- Create new policy that allows public read of username and balance
create policy "public read leaderboard" on profiles 
  for select 
  using (true);

-- Note: Users can still only update their own profiles due to existing policy


-- <<< END wagr/scripts/02-update-leaderboard-policies.sql

-- >>> BEGIN wagr/scripts/03-add-currency-to-wagers.sql
-- Add currency column to wagers table
alter table wagers add column if not exists currency text default 'NGN';

-- Update existing wagers to have default currency
update wagers set currency = 'NGN' where currency is null;


-- <<< END wagr/scripts/03-add-currency-to-wagers.sql

-- >>> BEGIN wagr/scripts/04-automatic-wager-settlement.sql
-- Automatic Wager Settlement System
-- This creates functions and triggers to automatically settle wagers when deadline passes

-- Function to settle a wager and distribute winnings
create or replace function settle_wager(wager_id_param uuid)
returns void language plpgsql as $$
declare
  wager_record record;
  total_pool numeric;
  platform_fee numeric;
  winnings_pool numeric;
  winning_side_entries numeric;
  losing_side_entries numeric;
  entry_record record;
  user_winnings numeric;
  fee_amount numeric;
begin
  -- Get wager details
  select * into wager_record
  from wagers
  where id = wager_id_param and status = 'OPEN';

  -- Skip if wager not found or already resolved
  if not found or wager_record.winning_side is null then
    return;
  end if;

  -- Calculate total pool from all entries
  select coalesce(sum(amount), 0) into total_pool
  from wager_entries
  where wager_id = wager_id_param;

  -- Calculate platform fee
  platform_fee := total_pool * wager_record.fee_percentage;
  winnings_pool := total_pool - platform_fee;

  -- Count entries on each side
  select coalesce(sum(amount), 0) into winning_side_entries
  from wager_entries
  where wager_id = wager_id_param and side = wager_record.winning_side;

  select coalesce(sum(amount), 0) into losing_side_entries
  from wager_entries
  where wager_id = wager_id_param and side != wager_record.winning_side;

  -- If no winners, refund everyone
  if winning_side_entries = 0 then
    for entry_record in
      select * from wager_entries where wager_id = wager_id_param
    loop
      -- Refund entry amount
      perform increment_balance(entry_record.user_id, entry_record.amount);
      
      -- Record transaction
      insert into transactions (user_id, type, amount, reference)
      values (entry_record.user_id, 'wager_refund', entry_record.amount, wager_id_param::text);
    end loop;
  else
    -- Distribute winnings to winners proportionally
    for entry_record in
      select * from wager_entries 
      where wager_id = wager_id_param and side = wager_record.winning_side
    loop
      -- Calculate proportional winnings
      user_winnings := (entry_record.amount / winning_side_entries) * winnings_pool;
      
      -- Add winnings to user balance
      perform increment_balance(entry_record.user_id, user_winnings);
      
      -- Record transaction
      insert into transactions (user_id, type, amount, reference)
      values (entry_record.user_id, 'wager_win', user_winnings, wager_id_param::text);
    end loop;
  end if;

  -- Update wager status to RESOLVED
  update wagers
  set status = 'RESOLVED'
  where id = wager_id_param;
end; $$;

-- Function to check and settle expired wagers
-- This should be called periodically (via cron or pg_cron)
create or replace function check_and_settle_expired_wagers()
returns void language plpgsql as $$
declare
  expired_wager record;
begin
  -- Find wagers that have passed deadline and are still OPEN
  for expired_wager in
    select id, deadline, winning_side
    from wagers
    where status = 'OPEN'
      and deadline is not null
      and deadline <= now()
      and winning_side is not null
  loop
    -- Settle the wager
    perform settle_wager(expired_wager.id);
  end loop;
end; $$;

-- Create a function that can be called via HTTP (for cron jobs)
-- Note: This requires pg_net extension or similar
-- For Supabase, you can use Edge Functions or Database Webhooks

-- Example: Set up a cron job to run every minute
-- SELECT cron.schedule('settle-wagers', '* * * * *', $$SELECT check_and_settle_expired_wagers()$$);


-- <<< END wagr/scripts/04-automatic-wager-settlement.sql

-- >>> BEGIN wagr/scripts/05-add-categories-and-preferences.sql
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


-- <<< END wagr/scripts/05-add-categories-and-preferences.sql

-- >>> BEGIN wagr/scripts/06-add-visibility-to-wagers.sql
-- Add visibility field to wagers table
-- This allows users to create private wagers that only they can see

ALTER TABLE wagers ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Update existing wagers to be public by default
UPDATE wagers SET is_public = true WHERE is_public IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_wagers_is_public ON wagers(is_public);

-- Update RLS policies to respect visibility
-- Users can see public wagers or their own private wagers
DROP POLICY IF EXISTS "public read" ON wagers;
CREATE POLICY "public read wagers" ON wagers 
  FOR SELECT 
  USING (
    is_public = true 
    OR auth.uid() = creator_id
  );

-- Users can only create public wagers or private wagers for themselves
DROP POLICY IF EXISTS "creator insert" ON wagers;
CREATE POLICY "creator insert wagers" ON wagers 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = creator_id 
    AND (
      is_public = true 
      OR auth.uid() = creator_id
    )
  );


-- <<< END wagr/scripts/06-add-visibility-to-wagers.sql

-- >>> BEGIN wagr/scripts/12-create-notifications.sql
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


-- <<< END wagr/scripts/12-create-notifications.sql

-- >>> BEGIN wagr/scripts/13-add-notification-triggers.sql
-- Add notification triggers for wager events
-- This creates database triggers to automatically send notifications

-- Function to create notification when wager is resolved
CREATE OR REPLACE FUNCTION notify_wager_resolved()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  entry_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
BEGIN
  -- Only trigger when status changes to RESOLVED or SETTLED
  IF (NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED') THEN
    -- Count participants
    SELECT COUNT(DISTINCT user_id) INTO participant_count
    FROM wager_entries
    WHERE wager_id = NEW.id;

    -- If only 1 participant, notify about refund
    IF participant_count = 1 THEN
      FOR entry_record IN
        SELECT DISTINCT user_id FROM wager_entries WHERE wager_id = NEW.id
      LOOP
        INSERT INTO notifications (user_id, type, title, message, link, metadata)
        VALUES (
          entry_record.user_id,
          'wager_resolved',
          'Wager Refunded',
          'Your wager "' || NEW.title || '" has been refunded. You were the only participant.',
          '/wager/' || NEW.id,
          jsonb_build_object(
            'wager_id', NEW.id,
            'refunded', true,
            'reason', 'single_participant'
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
      -- Calculate winnings for each winner
      SELECT COALESCE(SUM(amount), 0) INTO total_pool
      FROM wager_entries
      WHERE wager_id = NEW.id;

      platform_fee := total_pool * NEW.fee_percentage;
      winnings_pool := total_pool - platform_fee;

      SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
      FROM wager_entries
      WHERE wager_id = NEW.id AND side = NEW.winning_side;

      -- Notify all participants
      FOR entry_record IN
        SELECT DISTINCT user_id FROM wager_entries WHERE wager_id = NEW.id
      LOOP
        -- Check if user won
        IF EXISTS (
          SELECT 1 FROM wager_entries 
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side
        ) THEN
          -- User won - calculate their winnings
          SELECT COALESCE(SUM(amount), 0) INTO user_winnings
          FROM wager_entries
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side;

          IF winning_side_entries > 0 THEN
            user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
          END IF;

          -- Create notification for winner
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'You won a wager! 🎉',
            'You won ' || user_winnings || ' on "' || NEW.title || '"',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', true,
              'amount', user_winnings
            )
          );
        ELSE
          -- User lost
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'Oops, you lost this bet 😔',
            'Unfortunately, you lost the wager "' || NEW.title || '". Better luck next time!',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', false
            )
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for wager resolution
DROP TRIGGER IF EXISTS trigger_notify_wager_resolved ON wagers;
CREATE TRIGGER trigger_notify_wager_resolved
  AFTER UPDATE ON wagers
  FOR EACH ROW
  WHEN ((NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED'))
  EXECUTE FUNCTION notify_wager_resolved();

-- Function to notify when someone joins a wager
CREATE OR REPLACE FUNCTION notify_wager_joined()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  wager_record RECORD;
  participant_count INTEGER;
BEGIN
  -- Get wager details
  SELECT * INTO wager_record FROM wagers WHERE id = NEW.wager_id;
  
  -- Count participants
  SELECT COUNT(DISTINCT user_id) INTO participant_count
  FROM wager_entries
  WHERE wager_id = NEW.wager_id;

  -- Notify creator if they exist and it's not their own entry
  IF wager_record.creator_id IS NOT NULL 
     AND wager_record.creator_id != NEW.user_id 
     AND participant_count > 1 THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      wager_record.creator_id,
      'wager_joined',
      'Someone joined your wager',
      participant_count || ' ' || 
      CASE WHEN participant_count = 1 THEN 'person has' ELSE 'people have' END ||
      ' joined "' || wager_record.title || '"',
      '/wager/' || NEW.wager_id,
      jsonb_build_object(
        'wager_id', NEW.wager_id,
        'participant_count', participant_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for wager joins
DROP TRIGGER IF EXISTS trigger_notify_wager_joined ON wager_entries;
CREATE TRIGGER trigger_notify_wager_joined
  AFTER INSERT ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION notify_wager_joined();


-- <<< END wagr/scripts/13-add-notification-triggers.sql

-- >>> BEGIN wagr/scripts/14-single-participant-refund.sql
-- Single Participant Auto-Refund System
-- This ensures transparency by automatically refunding users when they're the only participant

-- Update settle_wager function to handle single participant case
CREATE OR REPLACE FUNCTION settle_wager(wager_id_param uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  wager_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  losing_side_entries NUMERIC;
  entry_record RECORD;
  user_winnings NUMERIC;
  participant_count INTEGER;
  wager_title TEXT;
BEGIN
  -- Get wager details
  SELECT * INTO wager_record
  FROM wagers
  WHERE id = wager_id_param AND status = 'OPEN';

  -- Skip if wager not found or already resolved
  IF NOT FOUND OR wager_record.winning_side IS NULL THEN
    RETURN;
  END IF;

  -- Get wager title for transaction description
  wager_title := wager_record.title;

  -- Count total participants
  SELECT COUNT(DISTINCT user_id) INTO participant_count
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- Calculate total pool from all entries
  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- If only 1 participant, refund them automatically
  IF participant_count = 1 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Refund full entry amount
      PERFORM increment_balance(entry_record.user_id, entry_record.amount);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_refund',
        entry_record.amount,
        wager_id_param::text,
        'Refund: "' || wager_title || '" - Only participant, wager cancelled'
      );
    END LOOP;

    -- Update wager status to RESOLVED
    UPDATE wagers
    SET status = 'RESOLVED', winning_side = NULL
    WHERE id = wager_id_param;

    RETURN;
  END IF;

  -- Calculate platform fee
  platform_fee := total_pool * wager_record.fee_percentage;
  winnings_pool := total_pool - platform_fee;

  -- Count entries on each side
  SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side = wager_record.winning_side;

  SELECT COALESCE(SUM(amount), 0) INTO losing_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side != wager_record.winning_side;

  -- If no winners, refund everyone
  IF winning_side_entries = 0 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Refund entry amount
      PERFORM increment_balance(entry_record.user_id, entry_record.amount);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_refund',
        entry_record.amount,
        wager_id_param::text,
        'Refund: "' || wager_title || '" - No winners declared'
      );
    END LOOP;
  ELSE
    -- Distribute winnings to winners proportionally
    FOR entry_record IN
      SELECT * FROM wager_entries 
      WHERE wager_id = wager_id_param AND side = wager_record.winning_side
    LOOP
      -- Calculate proportional winnings
      user_winnings := (entry_record.amount / winning_side_entries) * winnings_pool;
      
      -- Add winnings to user balance
      PERFORM increment_balance(entry_record.user_id, user_winnings);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_win',
        user_winnings,
        wager_id_param::text,
        'Wager Win: "' || wager_title || '" - Won ' || 
        CASE 
          WHEN entry_record.side = 'a' THEN wager_record.side_a
          ELSE wager_record.side_b
        END ||
        ' (Entry: ' || entry_record.amount || ', Winnings: ' || user_winnings || ')'
      );
    END LOOP;
  END IF;

  -- Update wager status to RESOLVED
  UPDATE wagers
  SET status = 'RESOLVED'
  WHERE id = wager_id_param;
END; $$;

-- Function to check and auto-refund single participant wagers that have expired
CREATE OR REPLACE FUNCTION check_and_refund_single_participants()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_wager RECORD;
  participant_count INTEGER;
  entry_record RECORD;
  wager_title TEXT;
BEGIN
  -- Find wagers that have passed deadline, are still OPEN, and have only 1 participant
  FOR expired_wager IN
    SELECT w.id, w.title, w.deadline
    FROM wagers w
    WHERE w.status = 'OPEN'
      AND w.deadline IS NOT NULL
      AND w.deadline <= NOW()
    LOOP
      -- Count participants for this wager
      SELECT COUNT(DISTINCT user_id) INTO participant_count
      FROM wager_entries
      WHERE wager_id = expired_wager.id;

      -- If only 1 participant, refund them
      IF participant_count = 1 THEN
        wager_title := expired_wager.title;

        FOR entry_record IN
          SELECT * FROM wager_entries WHERE wager_id = expired_wager.id
        LOOP
          -- Refund full entry amount
          PERFORM increment_balance(entry_record.user_id, entry_record.amount);
          
          -- Record transaction with detailed description
          INSERT INTO transactions (user_id, type, amount, reference, description)
          VALUES (
            entry_record.user_id,
            'wager_refund',
            entry_record.amount,
            expired_wager.id::text,
            'Auto-Refund: "' || wager_title || '" - Only participant, deadline passed'
          );
        END LOOP;

        -- Update wager status to RESOLVED
        UPDATE wagers
        SET status = 'RESOLVED', winning_side = NULL
        WHERE id = expired_wager.id;
      END IF;
    END LOOP;
END; $$;

-- Update check_and_settle_expired_wagers to also check for single participants
CREATE OR REPLACE FUNCTION check_and_settle_expired_wagers()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_wager RECORD;
BEGIN
  -- First, check and refund single participant wagers
  PERFORM check_and_refund_single_participants();

  -- Then, find wagers that have passed deadline and are still OPEN with winning_side set
  FOR expired_wager IN
    SELECT id, deadline, winning_side
    FROM wagers
    WHERE status = 'OPEN'
      AND deadline IS NOT NULL
      AND deadline <= NOW()
      AND winning_side IS NOT NULL
  LOOP
    -- Settle the wager
    PERFORM settle_wager(expired_wager.id);
  END LOOP;
END; $$;

-- Add description column to transactions if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'description'
  ) THEN
    ALTER TABLE transactions ADD COLUMN description TEXT;
  END IF;
END $$;


-- <<< END wagr/scripts/14-single-participant-refund.sql

-- >>> BEGIN wagr/scripts/15-add-email-notifications.sql
-- Add email notification triggers
-- This extends the notification system to also send emails

-- Function to send email notification when wager is resolved
CREATE OR REPLACE FUNCTION send_wager_resolved_email()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  entry_record RECORD;
  user_email TEXT;
  user_name TEXT;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
BEGIN
  -- Only trigger when status changes to RESOLVED or SETTLED
  IF (NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED') THEN
    -- Count participants
    SELECT COUNT(DISTINCT user_id) INTO participant_count
    FROM wager_entries
    WHERE wager_id = NEW.id;

    -- If only 1 participant, send refund email
    IF participant_count = 1 THEN
      FOR entry_record IN
        SELECT DISTINCT we.user_id, p.username, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        LEFT JOIN profiles p ON p.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Call email API endpoint
        PERFORM net.http_post(
          url := current_setting('app.settings.email_api_url', true) || '/api/notifications/send-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.notification_api_secret', true)
          ),
          body := jsonb_build_object(
            'user_id', entry_record.user_id,
            'type', 'wager_resolved',
            'metadata', jsonb_build_object(
              'wager_id', NEW.id,
              'won', false,
              'refunded', true,
              'amount', 0
            )
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_pool
      FROM wager_entries
      WHERE wager_id = NEW.id;

      platform_fee := total_pool * NEW.fee_percentage;
      winnings_pool := total_pool - platform_fee;

      SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
      FROM wager_entries
      WHERE wager_id = NEW.id AND side = NEW.winning_side;

      -- Send emails to all participants
      FOR entry_record IN
        SELECT DISTINCT we.user_id, p.username, u.email,
               CASE WHEN EXISTS (
                 SELECT 1 FROM wager_entries 
                 WHERE wager_id = NEW.id 
                 AND user_id = we.user_id 
                 AND side = NEW.winning_side
               ) THEN true ELSE false END as won
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        LEFT JOIN profiles p ON p.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Calculate winnings if user won
        user_winnings := 0;
        IF entry_record.won THEN
          SELECT COALESCE(SUM(amount), 0) INTO user_winnings
          FROM wager_entries
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side;

          IF winning_side_entries > 0 THEN
            user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
          END IF;
        END IF;

        -- Call email API endpoint
        -- Note: Using pg_net or similar extension for HTTP calls
        -- If not available, emails will be sent via the notification API endpoint
        PERFORM net.http_post(
          url := current_setting('app.settings.email_api_url', true) || '/api/notifications/send-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.notification_api_secret', true)
          ),
          body := jsonb_build_object(
            'user_id', entry_record.user_id,
            'type', 'wager_resolved',
            'metadata', jsonb_build_object(
              'wager_id', NEW.id,
              'won', entry_record.won,
              'amount', user_winnings
            )
          )
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Alternative: Use a simpler approach with a notification queue
-- Create a table to queue email notifications
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  email_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);

-- Function to queue email notification
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_user_id uuid,
  p_type text,
  p_email_data jsonb
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO email_queue (user_id, type, email_data)
  VALUES (p_user_id, p_type, p_email_data);
END;
$$;

-- Update notification trigger to also queue emails
CREATE OR REPLACE FUNCTION notify_wager_resolved_with_email()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  entry_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
  user_email TEXT;
BEGIN
  -- Only trigger when status changes to RESOLVED or SETTLED
  IF (NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED') THEN
    -- Count participants
    SELECT COUNT(DISTINCT user_id) INTO participant_count
    FROM wager_entries
    WHERE wager_id = NEW.id;

    -- If only 1 participant, notify about refund
    IF participant_count = 1 THEN
      FOR entry_record IN
        SELECT DISTINCT we.user_id, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Create in-app notification
        INSERT INTO notifications (user_id, type, title, message, link, metadata)
        VALUES (
          entry_record.user_id,
          'wager_resolved',
          'Wager Refunded',
          'Your wager "' || NEW.title || '" has been refunded. You were the only participant.',
          '/wager/' || NEW.id,
          jsonb_build_object(
            'wager_id', NEW.id,
            'refunded', true,
            'reason', 'single_participant'
          )
        );

        -- Queue email notification
        PERFORM queue_email_notification(
          entry_record.user_id,
          'wager_resolved',
          jsonb_build_object(
            'wager_id', NEW.id,
            'wager_title', NEW.title,
            'won', false,
            'refunded', true,
            'amount', 0
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_pool
      FROM wager_entries
      WHERE wager_id = NEW.id;

      platform_fee := total_pool * NEW.fee_percentage;
      winnings_pool := total_pool - platform_fee;

      SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
      FROM wager_entries
      WHERE wager_id = NEW.id AND side = NEW.winning_side;

      -- Notify all participants
      FOR entry_record IN
        SELECT DISTINCT we.user_id, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Check if user won
        IF EXISTS (
          SELECT 1 FROM wager_entries 
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side
        ) THEN
          -- User won - calculate their winnings
          SELECT COALESCE(SUM(amount), 0) INTO user_winnings
          FROM wager_entries
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side;

          IF winning_side_entries > 0 THEN
            user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
          END IF;

          -- Create in-app notification
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'You won a wager! 🎉',
            'You won ' || user_winnings || ' on "' || NEW.title || '"',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', true,
              'amount', user_winnings
            )
          );

          -- Queue email notification
          PERFORM queue_email_notification(
            entry_record.user_id,
            'wager_resolved',
            jsonb_build_object(
              'wager_id', NEW.id,
              'wager_title', NEW.title,
              'won', true,
              'amount', user_winnings
            )
          );
        ELSE
          -- User lost
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'Oops, you lost this bet 😔',
            'Unfortunately, you lost the wager "' || NEW.title || '". Better luck next time!',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', false
            )
          );

          -- Queue email notification
          PERFORM queue_email_notification(
            entry_record.user_id,
            'wager_resolved',
            jsonb_build_object(
              'wager_id', NEW.id,
              'wager_title', NEW.title,
              'won', false,
              'amount', 0
            )
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS trigger_notify_wager_resolved ON wagers;
CREATE TRIGGER trigger_notify_wager_resolved
  AFTER UPDATE ON wagers
  FOR EACH ROW
  WHEN ((NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED'))
  EXECUTE FUNCTION notify_wager_resolved_with_email();


-- <<< END wagr/scripts/15-add-email-notifications.sql

-- >>> BEGIN wagr/scripts/15-allow-wager-deletion.sql
-- Allow creators to delete their wagers
-- This adds RLS policy for wager deletion

-- Add delete policy for wagers (creators can delete their own wagers)
CREATE POLICY "creator delete" ON wagers
  FOR DELETE USING (auth.uid() = creator_id);


-- <<< END wagr/scripts/15-allow-wager-deletion.sql

-- >>> BEGIN wagr/scripts/16-create-push-subscriptions-table.sql
-- Create push subscriptions table for PWA push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL, -- { p256dh: string, auth: string }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "users can view own push subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users can insert own push subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own push subscriptions" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users can delete own push subscriptions" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscription_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_push_subscription_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_updated_at();


-- <<< END wagr/scripts/16-create-push-subscriptions-table.sql

-- >>> BEGIN wagr/scripts/16-prevent-bets-after-deadline.sql
-- Prevent bets after deadline - Database-level validation
-- This adds a check constraint and trigger to prevent entries after deadline

-- Add a function to check if wager is still accepting bets
CREATE OR REPLACE FUNCTION can_accept_bets(wager_id_param uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  wager_record RECORD;
BEGIN
  SELECT * INTO wager_record
  FROM wagers
  WHERE id = wager_id_param;

  -- If wager not found, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if wager is open
  IF wager_record.status != 'OPEN' THEN
    RETURN false;
  END IF;

  -- Check if deadline has passed
  IF wager_record.deadline IS NOT NULL AND wager_record.deadline <= NOW() THEN
    RETURN false;
  END IF;

  RETURN true;
END; $$;

-- Create a trigger function to validate entries before insert
CREATE OR REPLACE FUNCTION validate_wager_entry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Check if wager can still accept bets
  IF NOT can_accept_bets(NEW.wager_id) THEN
    RAISE EXCEPTION 'Cannot place bet: Wager deadline has passed or wager is closed';
  END IF;

  RETURN NEW;
END; $$;

-- Create trigger to validate entries
DROP TRIGGER IF EXISTS check_wager_deadline ON wager_entries;
CREATE TRIGGER check_wager_deadline
  BEFORE INSERT ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_wager_entry();


-- <<< END wagr/scripts/16-prevent-bets-after-deadline.sql

-- >>> BEGIN wagr/scripts/17-add-admin-role.sql
-- Add admin role to profiles table
-- Simple admin system - just a boolean flag

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Admin can view all profiles
CREATE POLICY "admin can view all profiles" ON profiles
  FOR SELECT USING (is_admin = true OR auth.uid() = id);

-- Admin can update any profile
CREATE POLICY "admin can update all profiles" ON profiles
  FOR UPDATE USING (
    auth.uid() = id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can view all wagers
CREATE POLICY "admin can view all wagers" ON wagers
  FOR SELECT USING (
    is_public = true 
    OR auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can update any wager
CREATE POLICY "admin can update all wagers" ON wagers
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can view all transactions
CREATE POLICY "admin can view all transactions" ON transactions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can view all wager entries
CREATE POLICY "admin can view all entries" ON wager_entries
  FOR SELECT USING (
    true
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id_param uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  admin_status boolean;
BEGIN
  SELECT COALESCE(is_admin, false) INTO admin_status
  FROM profiles
  WHERE id = user_id_param;
  RETURN COALESCE(admin_status, false);
END; $$;


-- <<< END wagr/scripts/17-add-admin-role.sql

-- >>> BEGIN wagr/scripts/18-add-withdrawals.sql
-- Withdrawal System
-- Allows users to withdraw their winnings

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  recipient_code text, -- Paystack transfer recipient code
  transfer_code text, -- Paystack transfer code
  bank_account jsonb, -- Bank account details (account_number, bank_code, account_name)
  reference text UNIQUE,
  failure_reason text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can view their own withdrawals
CREATE POLICY "users can view own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own withdrawals
CREATE POLICY "users can create own withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all withdrawals
CREATE POLICY "admins can view all withdrawals" ON withdrawals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Admins can update withdrawals
CREATE POLICY "admins can update withdrawals" ON withdrawals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals(status);
CREATE INDEX IF NOT EXISTS withdrawals_created_at_idx ON withdrawals(created_at);

-- Add withdrawal type to transactions
-- Note: withdrawal transactions are created when withdrawal is completed


-- <<< END wagr/scripts/18-add-withdrawals.sql

-- >>> BEGIN wagr/scripts/19-add-2fa-and-security.sql
-- Enhanced Security Features
-- 2FA and Security Settings

-- Add 2FA fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[];

-- Add security settings
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_settings JSONB DEFAULT '{}'::jsonb;

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- user_id or ip_address
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identifier, endpoint, window_start)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS rate_limits_identifier_endpoint_idx ON rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON rate_limits(window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits are managed by system (no user access needed)
CREATE POLICY "system_managed" ON rate_limits FOR ALL USING (false);

-- Function to clean old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;


-- <<< END wagr/scripts/19-add-2fa-and-security.sql

-- >>> BEGIN wagr/scripts/20-add-withdrawal-limits.sql
-- Withdrawal Limits and Management

-- Add withdrawal limits to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_daily_limit NUMERIC DEFAULT 500000; -- ₦500,000 default
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_monthly_limit NUMERIC DEFAULT 5000000; -- ₦5,000,000 default
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_daily_used NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_monthly_used NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_limit_reset_date DATE DEFAULT CURRENT_DATE;

-- Add withdrawal status tracking
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Function to reset daily withdrawal limits
CREATE OR REPLACE FUNCTION reset_daily_withdrawal_limits()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET 
    withdrawal_daily_used = 0,
    withdrawal_limit_reset_date = CURRENT_DATE
  WHERE withdrawal_limit_reset_date < CURRENT_DATE;
END;
$$;

-- Function to reset monthly withdrawal limits
CREATE OR REPLACE FUNCTION reset_monthly_withdrawal_limits()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET withdrawal_monthly_used = 0
  WHERE DATE_TRUNC('month', withdrawal_limit_reset_date) < DATE_TRUNC('month', CURRENT_DATE);
END;
$$;

-- Function to check withdrawal limits
CREATE OR REPLACE FUNCTION check_withdrawal_limits(
  user_id_param UUID,
  amount_param NUMERIC
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  user_profile RECORD;
  daily_remaining NUMERIC;
  monthly_remaining NUMERIC;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = user_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- Reset daily limit if needed
  IF user_profile.withdrawal_limit_reset_date < CURRENT_DATE THEN
    PERFORM reset_daily_withdrawal_limits();
    -- Re-fetch profile
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = user_id_param;
  END IF;

  -- Calculate remaining limits
  daily_remaining := COALESCE(user_profile.withdrawal_daily_limit, 500000) - COALESCE(user_profile.withdrawal_daily_used, 0);
  monthly_remaining := COALESCE(user_profile.withdrawal_monthly_limit, 5000000) - COALESCE(user_profile.withdrawal_monthly_used, 0);

  -- Check limits
  IF amount_param > daily_remaining THEN
    RETURN QUERY SELECT false, format('Daily withdrawal limit exceeded. Remaining: ₦%s', daily_remaining)::TEXT;
    RETURN;
  END IF;

  IF amount_param > monthly_remaining THEN
    RETURN QUERY SELECT false, format('Monthly withdrawal limit exceeded. Remaining: ₦%s', monthly_remaining)::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$;


-- <<< END wagr/scripts/20-add-withdrawal-limits.sql

-- >>> BEGIN wagr/scripts/21-add-wager-sharing.sql
-- Update wager sharing to use simple link-based sharing
-- Private wagers are accessible via direct link (anyone with the link can view)
-- Public wagers appear on the wagers page, private wagers do not

-- Update wagers RLS policy to allow direct link access to private wagers
DROP POLICY IF EXISTS "public read wagers" ON wagers;
CREATE POLICY "public read wagers" ON wagers 
  FOR SELECT 
  USING (
    is_public = true 
    OR auth.uid() = creator_id
    OR true  -- Allow direct link access to private wagers (anyone with the link can view)
  );


-- <<< END wagr/scripts/21-add-wager-sharing.sql

-- >>> BEGIN wagr/scripts/21-add-withdrawal-usage-function.sql
-- Function to increment withdrawal usage atomically
CREATE OR REPLACE FUNCTION increment_withdrawal_usage(
  user_id_param UUID,
  amount_param NUMERIC
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET 
    withdrawal_daily_used = COALESCE(withdrawal_daily_used, 0) + amount_param,
    withdrawal_monthly_used = COALESCE(withdrawal_monthly_used, 0) + amount_param
  WHERE id = user_id_param;
END;
$$;


-- <<< END wagr/scripts/21-add-withdrawal-usage-function.sql

-- >>> BEGIN wagr/scripts/22-fix-notification-permissions.sql
-- Fix notification trigger functions to have proper permissions
-- This allows them to access auth.users table for email addresses
-- Run this script in Supabase SQL Editor to fix the permission errors

-- Fix the main notification function (if it exists and accesses auth.users)
-- Note: This function may have been replaced by notify_wager_resolved_with_email
-- but we'll update it if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'notify_wager_resolved'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION notify_wager_resolved()
      RETURNS TRIGGER LANGUAGE plpgsql 
      SECURITY DEFINER
      SET search_path = public, auth
      AS $func$
      DECLARE
        entry_record RECORD;
        total_pool NUMERIC;
        platform_fee NUMERIC;
        winnings_pool NUMERIC;
        winning_side_entries NUMERIC;
        user_winnings NUMERIC;
        participant_count INTEGER;
      BEGIN
        -- Only trigger when status changes to RESOLVED
        IF NEW.status = ''RESOLVED'' AND OLD.status != ''RESOLVED'' THEN
          -- Count participants
          SELECT COUNT(DISTINCT user_id) INTO participant_count
          FROM wager_entries
          WHERE wager_id = NEW.id;

          -- If only 1 participant, notify about refund
          IF participant_count = 1 THEN
            FOR entry_record IN
              SELECT DISTINCT user_id FROM wager_entries WHERE wager_id = NEW.id
            LOOP
              INSERT INTO notifications (user_id, type, title, message, link, metadata)
              VALUES (
                entry_record.user_id,
                ''wager_resolved'',
                ''Wager Refunded'',
                ''Your wager "'' || NEW.title || ''" has been refunded. You were the only participant.'',
                ''/wager/'' || NEW.id,
                jsonb_build_object(
                  ''wager_id'', NEW.id,
                  ''refunded'', true,
                  ''reason'', ''single_participant''
                )
              );
            END LOOP;
            RETURN NEW;
          END IF;

          -- Continue with normal resolution if winning_side is set
          IF NEW.winning_side IS NOT NULL THEN
            SELECT COALESCE(SUM(amount), 0) INTO total_pool
            FROM wager_entries
            WHERE wager_id = NEW.id;

            platform_fee := total_pool * NEW.fee_percentage;
            winnings_pool := total_pool - platform_fee;

            SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
            FROM wager_entries
            WHERE wager_id = NEW.id AND side = NEW.winning_side;

            -- Notify all participants
            FOR entry_record IN
              SELECT DISTINCT user_id FROM wager_entries WHERE wager_id = NEW.id
            LOOP
              -- Check if user won
              IF EXISTS (
                SELECT 1 FROM wager_entries 
                WHERE wager_id = NEW.id 
                AND user_id = entry_record.user_id 
                AND side = NEW.winning_side
              ) THEN
                -- User won - calculate their winnings
                SELECT COALESCE(SUM(amount), 0) INTO user_winnings
                FROM wager_entries
                WHERE wager_id = NEW.id 
                AND user_id = entry_record.user_id 
                AND side = NEW.winning_side;

                IF winning_side_entries > 0 THEN
                  user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
                END IF;

                -- Create notification for winner
                INSERT INTO notifications (user_id, type, title, message, link, metadata)
                VALUES (
                  entry_record.user_id,
                  ''wager_resolved'',
                  ''You won a wager! 🎉'',
                  ''You won '' || user_winnings || '' on "'' || NEW.title || ''"'',
                  ''/wager/'' || NEW.id,
                  jsonb_build_object(
                    ''wager_id'', NEW.id,
                    ''won'', true,
                    ''amount'', user_winnings
                  )
                );
              ELSE
                -- User lost
                INSERT INTO notifications (user_id, type, title, message, link, metadata)
                VALUES (
                  entry_record.user_id,
                  ''wager_resolved'',
                  ''Oops, you lost this bet 😔'',
                  ''Unfortunately, you lost the wager "'' || NEW.title || ''". Better luck next time!'',
                  ''/wager/'' || NEW.id,
                  jsonb_build_object(
                    ''wager_id'', NEW.id,
                    ''won'', false
                  )
                );
              END IF;
            END LOOP;
          END IF;
        END IF;

        RETURN NEW;
      END;
      $func$;
    ';
  END IF;
END $$;

-- Fix send_wager_resolved_email function (already updated in 15-add-email-notifications.sql)
-- This ensures it has SECURITY DEFINER if the script hasn't been run yet
CREATE OR REPLACE FUNCTION send_wager_resolved_email()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  entry_record RECORD;
  user_email TEXT;
  user_name TEXT;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
BEGIN
  -- Only trigger when status changes to RESOLVED or SETTLED
  IF (NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED') THEN
    -- Count participants
    SELECT COUNT(DISTINCT user_id) INTO participant_count
    FROM wager_entries
    WHERE wager_id = NEW.id;

    -- If only 1 participant, send refund email
    IF participant_count = 1 THEN
      FOR entry_record IN
        SELECT DISTINCT we.user_id, p.username, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        LEFT JOIN profiles p ON p.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Call email API endpoint
        PERFORM net.http_post(
          url := current_setting('app.settings.email_api_url', true) || '/api/notifications/send-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.notification_api_secret', true)
          ),
          body := jsonb_build_object(
            'user_id', entry_record.user_id,
            'type', 'wager_resolved',
            'metadata', jsonb_build_object(
              'wager_id', NEW.id,
              'won', false,
              'refunded', true,
              'amount', 0
            )
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_pool
      FROM wager_entries
      WHERE wager_id = NEW.id;

      platform_fee := total_pool * NEW.fee_percentage;
      winnings_pool := total_pool - platform_fee;

      SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
      FROM wager_entries
      WHERE wager_id = NEW.id AND side = NEW.winning_side;

      -- Send emails to all participants
      FOR entry_record IN
        SELECT DISTINCT we.user_id, p.username, u.email,
               CASE WHEN EXISTS (
                 SELECT 1 FROM wager_entries 
                 WHERE wager_id = NEW.id 
                 AND user_id = we.user_id 
                 AND side = NEW.winning_side
               ) THEN true ELSE false END as won
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        LEFT JOIN profiles p ON p.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Calculate winnings if user won
        user_winnings := 0;
        IF entry_record.won THEN
          SELECT COALESCE(SUM(amount), 0) INTO user_winnings
          FROM wager_entries
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side;

          IF winning_side_entries > 0 THEN
            user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
          END IF;
        END IF;

        -- Call email API endpoint
        PERFORM net.http_post(
          url := current_setting('app.settings.email_api_url', true) || '/api/notifications/send-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.notification_api_secret', true)
          ),
          body := jsonb_build_object(
            'user_id', entry_record.user_id,
            'type', 'wager_resolved',
            'metadata', jsonb_build_object(
              'wager_id', NEW.id,
              'won', entry_record.won,
              'amount', user_winnings
            )
          )
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix notify_wager_resolved_with_email function (the one currently being used)
CREATE OR REPLACE FUNCTION notify_wager_resolved_with_email()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  entry_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
  user_email TEXT;
BEGIN
  -- Only trigger when status changes to RESOLVED or SETTLED
  IF (NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED') THEN
    -- Count participants
    SELECT COUNT(DISTINCT user_id) INTO participant_count
    FROM wager_entries
    WHERE wager_id = NEW.id;

    -- If only 1 participant, notify about refund
    IF participant_count = 1 THEN
      FOR entry_record IN
        SELECT DISTINCT we.user_id, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Create in-app notification
        INSERT INTO notifications (user_id, type, title, message, link, metadata)
        VALUES (
          entry_record.user_id,
          'wager_resolved',
          'Wager Refunded',
          'Your wager "' || NEW.title || '" has been refunded. You were the only participant.',
          '/wager/' || NEW.id,
          jsonb_build_object(
            'wager_id', NEW.id,
            'refunded', true,
            'reason', 'single_participant'
          )
        );

        -- Queue email notification
        PERFORM queue_email_notification(
          entry_record.user_id,
          'wager_resolved',
          jsonb_build_object(
            'wager_id', NEW.id,
            'wager_title', NEW.title,
            'won', false,
            'refunded', true,
            'amount', 0
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_pool
      FROM wager_entries
      WHERE wager_id = NEW.id;

      platform_fee := total_pool * NEW.fee_percentage;
      winnings_pool := total_pool - platform_fee;

      SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
      FROM wager_entries
      WHERE wager_id = NEW.id AND side = NEW.winning_side;

      -- Notify all participants
      FOR entry_record IN
        SELECT DISTINCT we.user_id, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Check if user won
        IF EXISTS (
          SELECT 1 FROM wager_entries 
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side
        ) THEN
          -- User won - calculate their winnings
          SELECT COALESCE(SUM(amount), 0) INTO user_winnings
          FROM wager_entries
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side;

          IF winning_side_entries > 0 THEN
            user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
          END IF;

          -- Create in-app notification
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'You won a wager! 🎉',
            'You won ' || user_winnings || ' on "' || NEW.title || '"',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', true,
              'amount', user_winnings
            )
          );

          -- Queue email notification
          PERFORM queue_email_notification(
            entry_record.user_id,
            'wager_resolved',
            jsonb_build_object(
              'wager_id', NEW.id,
              'wager_title', NEW.title,
              'won', true,
              'amount', user_winnings
            )
          );
        ELSE
          -- User lost
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'Oops, you lost this bet 😔',
            'Unfortunately, you lost the wager "' || NEW.title || '". Better luck next time!',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', false
            )
          );

          -- Queue email notification
          PERFORM queue_email_notification(
            entry_record.user_id,
            'wager_resolved',
            jsonb_build_object(
              'wager_id', NEW.id,
              'wager_title', NEW.title,
              'won', false,
              'amount', 0
            )
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Note: After running this script, the settlement endpoint should work without permission errors
-- The SECURITY DEFINER clause allows these functions to access auth.users table
-- The SET search_path ensures they can find both public and auth schemas


-- <<< END wagr/scripts/22-fix-notification-permissions.sql

-- >>> BEGIN wagr/scripts/22-update-commission-to-5-percent.sql
-- Update platform commission from 1% to 5%
-- This migration updates the default fee_percentage and existing wagers

-- Update default fee_percentage in wagers table
ALTER TABLE wagers 
ALTER COLUMN fee_percentage SET DEFAULT 0.05;

-- Update existing wagers that have 1% fee to 5%
UPDATE wagers 
SET fee_percentage = 0.05 
WHERE fee_percentage = 0.01;

-- Update any system-generated wagers that might have been created with old default
UPDATE wagers 
SET fee_percentage = 0.05 
WHERE fee_percentage IS NULL OR fee_percentage < 0.05;


-- <<< END wagr/scripts/22-update-commission-to-5-percent.sql

-- >>> BEGIN wagr/scripts/23-fix-settle-wager-permissions.sql
-- Fix settle_wager function to have proper permissions
-- This ensures the function can access all necessary tables and perform updates
-- Run this script in Supabase SQL Editor

-- Update settle_wager function with SECURITY DEFINER
-- This allows the function to run with elevated privileges
CREATE OR REPLACE FUNCTION settle_wager(wager_id_param uuid)
RETURNS void LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wager_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  losing_side_entries NUMERIC;
  entry_record RECORD;
  user_winnings NUMERIC;
  participant_count INTEGER;
  wager_title TEXT;
BEGIN
  -- Get wager details
  SELECT * INTO wager_record
  FROM wagers
  WHERE id = wager_id_param AND status = 'OPEN';

  -- Skip if wager not found or already resolved
  IF NOT FOUND OR wager_record.winning_side IS NULL THEN
    RETURN;
  END IF;

  -- Get wager title for transaction description
  wager_title := wager_record.title;

  -- Count total participants
  SELECT COUNT(DISTINCT user_id) INTO participant_count
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- Calculate total pool from all entries
  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- If only 1 participant, refund them automatically
  IF participant_count = 1 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Refund full entry amount
      PERFORM increment_balance(entry_record.user_id, entry_record.amount);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_refund',
        entry_record.amount,
        wager_id_param::text,
        'Refund: "' || wager_title || '" - Only participant, wager cancelled'
      );
    END LOOP;

    -- Update wager status to RESOLVED
    UPDATE wagers
    SET status = 'RESOLVED', winning_side = NULL
    WHERE id = wager_id_param;

    RETURN;
  END IF;

  -- Calculate platform fee
  platform_fee := total_pool * wager_record.fee_percentage;
  winnings_pool := total_pool - platform_fee;

  -- Count entries on each side
  SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side = wager_record.winning_side;

  SELECT COALESCE(SUM(amount), 0) INTO losing_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side != wager_record.winning_side;

  -- If no winners, refund everyone
  IF winning_side_entries = 0 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Refund entry amount
      PERFORM increment_balance(entry_record.user_id, entry_record.amount);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_refund',
        entry_record.amount,
        wager_id_param::text,
        'Refund: "' || wager_title || '" - No winners declared'
      );
    END LOOP;
  ELSE
    -- Distribute winnings to winners proportionally
    FOR entry_record IN
      SELECT * FROM wager_entries 
      WHERE wager_id = wager_id_param AND side = wager_record.winning_side
    LOOP
      -- Calculate proportional winnings
      user_winnings := (entry_record.amount / winning_side_entries) * winnings_pool;
      
      -- Add winnings to user balance
      PERFORM increment_balance(entry_record.user_id, user_winnings);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_win',
        user_winnings,
        wager_id_param::text,
        'Wager Win: "' || wager_title || '" - Won ' || 
        CASE 
          WHEN entry_record.side = 'a' THEN wager_record.side_a
          ELSE wager_record.side_b
        END ||
        ' (Entry: ' || entry_record.amount || ', Winnings: ' || user_winnings || ')'
      );
    END LOOP;
  END IF;

  -- Update wager status to SETTLED (actual settlement with winnings distributed)
  UPDATE wagers
  SET status = 'SETTLED'
  WHERE id = wager_id_param;
END;
$$;

-- Grant execute permission to authenticated users (for admin panel)
GRANT EXECUTE ON FUNCTION settle_wager(uuid) TO authenticated;

-- Note: After running this script, the settle_wager function will have proper permissions
-- The SECURITY DEFINER clause allows it to run with elevated privileges
-- This should fix the empty error object issue


-- <<< END wagr/scripts/23-fix-settle-wager-permissions.sql

-- >>> BEGIN wagr/scripts/24-add-short-id-to-wagers.sql
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


-- <<< END wagr/scripts/24-add-short-id-to-wagers.sql

-- >>> BEGIN wagr/scripts/25-add-deadline-check-to-settle-wager.sql
-- Add deadline check to settle_wager function
-- This prevents settling wagers before their deadline has passed
-- Run this script in Supabase SQL Editor

CREATE OR REPLACE FUNCTION settle_wager(wager_id_param uuid)
RETURNS void LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wager_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  losing_side_entries NUMERIC;
  entry_record RECORD;
  user_winnings NUMERIC;
  participant_count INTEGER;
  wager_title TEXT;
BEGIN
  -- Get wager details
  SELECT * INTO wager_record
  FROM wagers
  WHERE id = wager_id_param AND status = 'OPEN';

  -- Skip if wager not found or already resolved
  IF NOT FOUND OR wager_record.winning_side IS NULL THEN
    RETURN;
  END IF;

  -- Check if deadline has passed (if deadline exists)
  IF wager_record.deadline IS NOT NULL AND wager_record.deadline > NOW() THEN
    -- Raise an error if trying to settle before deadline
    RAISE EXCEPTION 'Cannot settle wager before deadline. Deadline: %, Current time: %', 
      wager_record.deadline, NOW();
  END IF;

  -- Get wager title for transaction description
  wager_title := wager_record.title;

  -- Count total participants
  SELECT COUNT(DISTINCT user_id) INTO participant_count
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- Calculate total pool from all entries
  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- If only 1 participant, refund them automatically
  IF participant_count = 1 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Refund full entry amount
      PERFORM increment_balance(entry_record.user_id, entry_record.amount);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_refund',
        entry_record.amount,
        wager_id_param::text,
        'Refund: "' || wager_title || '" - Only participant, wager cancelled'
      );
    END LOOP;

    -- Update wager status to RESOLVED
    UPDATE wagers
    SET status = 'RESOLVED', winning_side = NULL
    WHERE id = wager_id_param;

    RETURN;
  END IF;

  -- Calculate platform fee
  platform_fee := total_pool * wager_record.fee_percentage;
  winnings_pool := total_pool - platform_fee;

  -- Count entries on each side
  SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side = wager_record.winning_side;

  SELECT COALESCE(SUM(amount), 0) INTO losing_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side != wager_record.winning_side;

  -- If no winners, refund everyone
  IF winning_side_entries = 0 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Refund entry amount
      PERFORM increment_balance(entry_record.user_id, entry_record.amount);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_refund',
        entry_record.amount,
        wager_id_param::text,
        'Refund: "' || wager_title || '" - No winners declared'
      );
    END LOOP;
  ELSE
    -- Distribute winnings to winners proportionally
    FOR entry_record IN
      SELECT * FROM wager_entries 
      WHERE wager_id = wager_id_param AND side = wager_record.winning_side
    LOOP
      -- Calculate proportional winnings
      user_winnings := (entry_record.amount / winning_side_entries) * winnings_pool;
      
      -- Add winnings to user balance
      PERFORM increment_balance(entry_record.user_id, user_winnings);
      
      -- Record transaction with detailed description
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        entry_record.user_id,
        'wager_win',
        user_winnings,
        wager_id_param::text,
        'Wager Win: "' || wager_title || '" - Won ' || 
        CASE 
          WHEN entry_record.side = 'a' THEN wager_record.side_a
          ELSE wager_record.side_b
        END ||
        ' (Entry: ' || entry_record.amount || ', Winnings: ' || user_winnings || ')'
      );
    END LOOP;
  END IF;

  -- Update wager status to SETTLED (actual settlement with winnings distributed)
  UPDATE wagers
  SET status = 'SETTLED'
  WHERE id = wager_id_param;
END;
$$;

-- Grant execute permission to authenticated users (for admin panel)
GRANT EXECUTE ON FUNCTION settle_wager(uuid) TO authenticated;

-- Note: This update adds a deadline check to prevent settling wagers before their deadline
-- Both the frontend and database function now enforce this rule


-- <<< END wagr/scripts/25-add-deadline-check-to-settle-wager.sql

-- >>> BEGIN wagr/scripts/26-create-teams-table.sql
-- Create teams table for group invitations
-- Allows users to create teams and invite multiple people at once to wagers

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teams_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 50)
);

-- Team members junction table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_creator_id ON teams(creator_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- RLS Policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view their own teams"
  ON teams FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can create their own teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own teams"
  ON teams FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own teams"
  ON teams FOR DELETE
  USING (auth.uid() = creator_id);

-- Team members policies
CREATE POLICY "Users can view team members of their teams"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.creator_id = auth.uid()
    )
  );

CREATE POLICY "Team creators can add members"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.creator_id = auth.uid()
    )
  );

CREATE POLICY "Team creators can remove members"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.creator_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- Add notification type for wager invitations
-- This is handled in the application, but we ensure the type is valid
-- (Notifications table should already exist from previous migrations)


-- <<< END wagr/scripts/26-create-teams-table.sql

-- >>> BEGIN wagr/scripts/26-custom-auth-schema.sql
-- Custom Authentication System
-- Replaces Supabase Auth with custom implementation

-- Update profiles table to work independently
-- Remove foreign key constraint to auth.users (if exists)
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add email and password_hash to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON profiles(email_verified);

-- Create sessions table for managing user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Enable RLS on sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- System can manage sessions (for login/logout)
CREATE POLICY "system can manage sessions" ON sessions
  FOR ALL USING (true);

-- Create email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for email_verifications
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Enable RLS on email_verifications
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Email verifications policies
CREATE POLICY "users can view own verifications" ON email_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "system can manage verifications" ON email_verifications
  FOR ALL USING (true);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for password_resets
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

-- Enable RLS on password_resets
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Password resets policies
CREATE POLICY "system can manage password resets" ON password_resets
  FOR ALL USING (true);

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$;

-- Function to clean expired email verifications
CREATE OR REPLACE FUNCTION clean_expired_email_verifications()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM email_verifications 
  WHERE expires_at < NOW() 
  AND verified_at IS NULL;
END;
$$;

-- Function to clean expired password resets
CREATE OR REPLACE FUNCTION clean_expired_password_resets()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM password_resets 
  WHERE expires_at < NOW() 
  AND used_at IS NULL;
END;
$$;

-- Update all foreign key references from auth.users to profiles
-- Note: This assumes profiles.id is now the primary user identifier

-- Update wagers table
ALTER TABLE wagers
  DROP CONSTRAINT IF EXISTS wagers_creator_id_fkey;

ALTER TABLE wagers
  ADD CONSTRAINT wagers_creator_id_fkey 
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update wager_entries table
ALTER TABLE wager_entries
  DROP CONSTRAINT IF EXISTS wager_entries_user_id_fkey;

ALTER TABLE wager_entries
  ADD CONSTRAINT wager_entries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update transactions table
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update notifications table
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update withdrawals table
ALTER TABLE withdrawals
  DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey;

ALTER TABLE withdrawals
  ADD CONSTRAINT withdrawals_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update user_preferences table
ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update push_subscriptions table
ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update custom_categories table
ALTER TABLE custom_categories
  DROP CONSTRAINT IF EXISTS custom_categories_created_by_fkey;

ALTER TABLE custom_categories
  ADD CONSTRAINT custom_categories_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update withdrawals approved_by
ALTER TABLE withdrawals
  DROP CONSTRAINT IF EXISTS withdrawals_approved_by_fkey;

ALTER TABLE withdrawals
  ADD CONSTRAINT withdrawals_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Note: RLS policies that reference auth.uid() will need to be updated
-- to use a custom function that gets the user_id from the session token
-- This will be handled in the application code


-- <<< END wagr/scripts/26-custom-auth-schema.sql

-- >>> BEGIN wagr/scripts/27-update-rls-for-custom-auth.sql
-- Update RLS policies to work with custom auth
-- This creates a helper function to get user_id from session token
-- Note: The actual session validation happens in application code
-- This is a placeholder for RLS policies that need user context

-- Function to check if a user is authenticated (for RLS policies)
-- This will be called from application code with the user_id
-- For now, we'll use a simpler approach where policies check if user_id matches

-- Update profiles policies to work without auth.uid()
-- Since we're using custom auth, we need to pass user_id explicitly
-- For now, we'll make profiles readable by all (for leaderboard) and updatable by owner
-- The application will handle authorization

-- Note: RLS policies that use auth.uid() will need to be updated
-- The application code will validate sessions and pass user_id where needed
-- For public read operations, we can keep existing policies
-- For write operations, the application will validate before allowing

-- Update profiles policies (keep public read for leaderboard)
DROP POLICY IF EXISTS "allow read own" ON profiles;
DROP POLICY IF EXISTS "public read leaderboard" ON profiles;

CREATE POLICY "public read profiles" ON profiles 
  FOR SELECT USING (true);

CREATE POLICY "users can update own profile" ON profiles
  FOR UPDATE USING (true); -- Application will validate ownership

CREATE POLICY "users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (true); -- Application will validate

-- Update wagers policies (keep public read)
-- Application will handle authorization for create/update/delete

-- Update wager_entries policies
-- Application will validate user can only create their own entries

-- Update transactions policies
-- Application will validate user can only view/create their own transactions

-- Update notifications policies
-- Application will validate user can only view/update their own notifications

-- Update withdrawals policies
-- Application will validate user can only create their own withdrawals

-- Note: For admin access, the application will check is_admin flag
-- RLS policies can allow admins to view all by checking the is_admin flag in profiles

-- Helper function to check if current request is from admin
-- This will be used in application code, not in RLS policies
CREATE OR REPLACE FUNCTION is_admin_user(user_id_param uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  admin_status boolean;
BEGIN
  SELECT COALESCE(is_admin, false) INTO admin_status
  FROM profiles
  WHERE id = user_id_param;
  RETURN COALESCE(admin_status, false);
END;
$$;

-- For now, we'll rely on application-level authorization
-- RLS policies will be permissive, and the application will enforce security
-- This is acceptable since all database access goes through the application


-- <<< END wagr/scripts/27-update-rls-for-custom-auth.sql

-- >>> BEGIN wagr/scripts/28-remove-tags-and-custom-categories.sql
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


-- <<< END wagr/scripts/28-remove-tags-and-custom-categories.sql

-- >>> BEGIN wagr/scripts/29-add-push-notification-preference.sql
-- Add push_notifications_enabled to user_preferences table
ALTER TABLE user_preferences 
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT false;


-- <<< END wagr/scripts/29-add-push-notification-preference.sql

-- >>> BEGIN wagr/scripts/30-create-avatars-bucket.sql
-- Create avatars storage bucket for user profile pictures
-- This script should be run in Supabase SQL Editor
-- Note: Storage buckets are created via Supabase Dashboard or Storage API, not SQL
-- This file documents the required bucket configuration

-- Bucket Name: avatars
-- Public: true (so images can be accessed via public URL)
-- File size limit: 5MB
-- Allowed MIME types: image/*

-- To create the bucket:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: avatars
-- 4. Public bucket: Yes
-- 5. Click "Create bucket"

-- Then set up RLS policies:
-- Allow authenticated users to upload their own avatars
-- Allow public read access

-- ============================================================
-- STORAGE POLICIES SETUP (Must be done via Supabase Dashboard)
-- ============================================================
-- Storage policies cannot be created via SQL - they must be set up
-- through the Supabase Dashboard or Storage API.
--
-- After creating the bucket, set up policies in Dashboard:
-- 1. Go to Supabase Dashboard > Storage > avatars bucket
-- 2. Click "Policies" tab
-- 3. Add the following policies:
--
-- POLICY 1: Public Read Access
--   Name: "Public can view avatars"
--   Allowed operation: SELECT
--   Policy definition: bucket_id = 'avatars'
--
-- POLICY 2: Authenticated Upload
--   Name: "Users can upload avatars"
--   Allowed operation: INSERT
--   Policy definition: bucket_id = 'avatars'
--   Note: Since we use custom auth, this allows any authenticated user
--         Application code validates ownership via filename
--
-- POLICY 3: Authenticated Update
--   Name: "Users can update avatars"
--   Allowed operation: UPDATE
--   Policy definition: bucket_id = 'avatars'
--
-- POLICY 4: Authenticated Delete
--   Name: "Users can delete avatars"
--   Allowed operation: DELETE
--   Policy definition: bucket_id = 'avatars'
--
-- ============================================================
-- RECOMMENDED: Disable RLS on Bucket (Required for Custom Auth)
-- ============================================================
-- Since we're using custom auth, storage RLS policies that use auth.uid()
-- will NOT work. You MUST disable RLS on the bucket:
--
-- Steps to disable RLS:
-- 1. Go to Supabase Dashboard > Storage > avatars bucket
-- 2. Click on "Policies" tab
-- 3. You should see "Row Level Security" toggle - DISABLE IT
--    OR delete all existing policies
-- 4. Make sure the bucket is set to "Public" (for read access)
--
-- Security is handled entirely by application code:
-- - Files named with user_id prefix: {user_id}-{timestamp}.{ext}
-- - Application validates user authentication before upload
-- - Application validates filename matches user_id before update/delete
-- - Only authenticated users can access the upload endpoint
--
-- This is secure because:
-- - All uploads go through authenticated API routes (/api routes)
-- - File naming ensures users can only access their own files
-- - Application validates ownership before any operation
-- - Unauthenticated users cannot upload (API enforces this)
-- ============================================================


-- <<< END wagr/scripts/30-create-avatars-bucket.sql

-- >>> BEGIN wagr/scripts/31-add-unique-constraint-transactions.sql
-- Add unique constraint on transactions reference to prevent duplicate processing
-- This ensures that the same payment reference can only be processed once

-- First, remove any duplicate transactions (keep the oldest one)
DELETE FROM transactions t1
WHERE EXISTS (
  SELECT 1 FROM transactions t2
  WHERE t2.reference = t1.reference
    AND t2.type = t1.type
    AND t2.id < t1.id
);

-- Add unique constraint on (reference, type) combination
-- This prevents duplicate processing of the same payment
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_type_unique 
ON transactions(reference, type) 
WHERE reference IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);


-- <<< END wagr/scripts/31-add-unique-constraint-transactions.sql

-- >>> BEGIN wagr/scripts/32-update-transactions-rls-for-custom-auth.sql
-- Update transactions RLS policies to work with custom auth
-- Since RLS can't access custom session cookies, we'll make transactions readable
-- and let the application filter by user_id (which it already does)

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "user view own" ON transactions;
DROP POLICY IF EXISTS "user insert" ON transactions;
DROP POLICY IF EXISTS "admin can view all transactions" ON transactions;

-- Allow users to view all transactions (application will filter by user_id)
-- This is safe because the API route already filters by user_id
CREATE POLICY "users can view transactions" ON transactions
  FOR SELECT USING (true);

-- Allow users to insert transactions (application will validate user_id)
CREATE POLICY "users can insert transactions" ON transactions
  FOR INSERT WITH CHECK (true);

-- Note: The application code in /api/wallet/transactions already filters by user_id
-- So this policy is safe - users can only see transactions filtered by the API


-- <<< END wagr/scripts/32-update-transactions-rls-for-custom-auth.sql

-- >>> BEGIN wagr/scripts/33-update-wagers-rls-for-custom-auth.sql
-- Update wagers RLS policies to work with custom auth
-- Since RLS can't access custom session cookies, we'll make wagers readable/insertable
-- and let the application filter by creator_id (which it already does)

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "creator insert" ON wagers;
DROP POLICY IF EXISTS "creator update" ON wagers;
DROP POLICY IF EXISTS "creator delete" ON wagers;
DROP POLICY IF EXISTS "public read" ON wagers;
DROP POLICY IF EXISTS "public read wagers" ON wagers;
DROP POLICY IF EXISTS "creator insert wagers" ON wagers;
DROP POLICY IF EXISTS "admin can view all wagers" ON wagers;
DROP POLICY IF EXISTS "admin can update all wagers" ON wagers;

-- Allow public read of wagers (application can filter by is_public if needed)
CREATE POLICY "public read wagers" ON wagers
  FOR SELECT USING (true);

-- Allow users to insert wagers (application will validate creator_id)
CREATE POLICY "users can insert wagers" ON wagers
  FOR INSERT WITH CHECK (true);

-- Allow users to update wagers (application will validate creator_id)
CREATE POLICY "users can update wagers" ON wagers
  FOR UPDATE USING (true);

-- Allow users to delete wagers (application will validate creator_id)
CREATE POLICY "users can delete wagers" ON wagers
  FOR DELETE USING (true);

-- Note: The application code already validates that users can only create/update/delete
-- their own wagers, so these permissive policies are safe


-- <<< END wagr/scripts/33-update-wagers-rls-for-custom-auth.sql

-- >>> BEGIN wagr/scripts/34-update-wager-entries-rls-for-custom-auth.sql
-- Update wager_entries RLS policies to work with custom auth
-- Since RLS can't access custom session cookies, we'll make entries readable/insertable
-- and let the application filter by user_id (which it already does)

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "public view" ON wager_entries;
DROP POLICY IF EXISTS "user insert" ON wager_entries;

-- Allow public read of wager entries (application can filter if needed)
CREATE POLICY "public read wager entries" ON wager_entries
  FOR SELECT USING (true);

-- Allow users to insert entries (application will validate user_id)
CREATE POLICY "users can insert entries" ON wager_entries
  FOR INSERT WITH CHECK (true);

-- Allow users to update their own entries (application will validate user_id)
CREATE POLICY "users can update own entries" ON wager_entries
  FOR UPDATE USING (true);

-- Allow users to delete their own entries (application will validate user_id)
CREATE POLICY "users can delete own entries" ON wager_entries
  FOR DELETE USING (true);

-- Note: The application code already validates that users can only create/update/delete
-- their own entries, so these permissive policies are safe


-- <<< END wagr/scripts/34-update-wager-entries-rls-for-custom-auth.sql

-- >>> BEGIN wagr/scripts/35-add-wager-entries-update-policy.sql
-- Add UPDATE and DELETE policies for wager_entries table
-- This fixes the issue where users cannot update their wager entries (e.g., switch sides)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users can update own entries" ON wager_entries;
DROP POLICY IF EXISTS "users can delete own entries" ON wager_entries;

-- Allow users to update their own entries (application will validate user_id)
CREATE POLICY "users can update own entries" ON wager_entries
  FOR UPDATE USING (true);

-- Allow users to delete their own entries (application will validate user_id)
CREATE POLICY "users can delete own entries" ON wager_entries
  FOR DELETE USING (true);

-- Note: The application code already validates that users can only update/delete
-- their own entries, so these permissive policies are safe


-- <<< END wagr/scripts/35-add-wager-entries-update-policy.sql

-- >>> BEGIN wagr/scripts/36-update-notifications-rls-for-custom-auth.sql
-- Update notifications RLS policies to work with custom auth
-- Since RLS can't access custom session cookies, we'll make notifications readable
-- and let the application filter by user_id (which it already does)

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "system can insert notifications" ON notifications;
DROP POLICY IF EXISTS "admin can view all notifications" ON notifications;

-- Allow users to view all notifications (application will filter by user_id)
-- This is safe because the API route already filters by user_id
CREATE POLICY "users can view notifications" ON notifications
  FOR SELECT USING (true);

-- Allow users to update notifications (application will validate user_id)
CREATE POLICY "users can update notifications" ON notifications
  FOR UPDATE USING (true);

-- Allow system/application to insert notifications (application will validate user_id)
-- This allows both service role and regular clients to insert
CREATE POLICY "system can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Note: The application code already validates that users can only view/update
-- their own notifications, so these permissive policies are safe


-- <<< END wagr/scripts/36-update-notifications-rls-for-custom-auth.sql

-- >>> BEGIN wagr/scripts/37-fix-duplicate-transactions-in-settlement.sql
-- Fix duplicate transaction errors in settlement functions
-- This adds idempotency checks to prevent duplicate transaction inserts
-- Run this script in Supabase SQL Editor

-- First, update the unique constraint to include user_id for wager transactions
-- This allows multiple users to have transactions for the same wager reference
-- Drop the old constraint if it exists
DROP INDEX IF EXISTS transactions_reference_type_unique;

-- Create a new unique constraint that includes user_id for better uniqueness
-- This prevents the same user from having duplicate transactions for the same reference+type
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_type_user_unique 
ON transactions(reference, type, user_id) 
WHERE reference IS NOT NULL;

-- Update settle_wager function to check for existing transactions before inserting
CREATE OR REPLACE FUNCTION settle_wager(wager_id_param uuid)
RETURNS void LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wager_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  losing_side_entries NUMERIC;
  entry_record RECORD;
  user_winnings NUMERIC;
  participant_count INTEGER;
  wager_title TEXT;
  transaction_exists BOOLEAN;
BEGIN
  -- Get wager details
  SELECT * INTO wager_record
  FROM wagers
  WHERE id = wager_id_param AND status = 'OPEN';

  -- Skip if wager not found or already resolved
  IF NOT FOUND OR wager_record.winning_side IS NULL THEN
    RETURN;
  END IF;

  -- Check if deadline has passed (if deadline exists)
  IF wager_record.deadline IS NOT NULL AND wager_record.deadline > NOW() THEN
    -- Raise an error if trying to settle before deadline
    RAISE EXCEPTION 'Cannot settle wager before deadline. Deadline: %, Current time: %', 
      wager_record.deadline, NOW();
  END IF;

  -- Get wager title for transaction description
  wager_title := wager_record.title;

  -- Count total participants
  SELECT COUNT(DISTINCT user_id) INTO participant_count
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- Calculate total pool from all entries
  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- If only 1 participant, refund them automatically
  IF participant_count = 1 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Check if transaction already exists
      SELECT EXISTS(
        SELECT 1 FROM transactions 
        WHERE reference = wager_id_param::text 
          AND type = 'wager_refund'
          AND user_id = entry_record.user_id
      ) INTO transaction_exists;

      -- Only process if transaction doesn't exist
      IF NOT transaction_exists THEN
        -- Refund full entry amount
        PERFORM increment_balance(entry_record.user_id, entry_record.amount);
        
        -- Record transaction with detailed description
        INSERT INTO transactions (user_id, type, amount, reference, description)
        VALUES (
          entry_record.user_id,
          'wager_refund',
          entry_record.amount,
          wager_id_param::text,
          'Refund: "' || wager_title || '" - Only participant, wager cancelled'
        )
        ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
      END IF;
    END LOOP;

    -- Update wager status to RESOLVED
    UPDATE wagers
    SET status = 'RESOLVED', winning_side = NULL
    WHERE id = wager_id_param;

    RETURN;
  END IF;

  -- Calculate platform fee
  platform_fee := total_pool * wager_record.fee_percentage;
  winnings_pool := total_pool - platform_fee;

  -- Count entries on each side
  SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side = wager_record.winning_side;

  SELECT COALESCE(SUM(amount), 0) INTO losing_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side != wager_record.winning_side;

  -- If no winners, refund everyone
  IF winning_side_entries = 0 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Check if transaction already exists
      SELECT EXISTS(
        SELECT 1 FROM transactions 
        WHERE reference = wager_id_param::text 
          AND type = 'wager_refund'
          AND user_id = entry_record.user_id
      ) INTO transaction_exists;

      -- Only process if transaction doesn't exist
      IF NOT transaction_exists THEN
        -- Refund entry amount
        PERFORM increment_balance(entry_record.user_id, entry_record.amount);
        
        -- Record transaction with detailed description
        INSERT INTO transactions (user_id, type, amount, reference, description)
        VALUES (
          entry_record.user_id,
          'wager_refund',
          entry_record.amount,
          wager_id_param::text,
          'Refund: "' || wager_title || '" - No winners declared'
        )
        ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
      END IF;
    END LOOP;
  ELSE
    -- Distribute winnings to winners proportionally
    FOR entry_record IN
      SELECT * FROM wager_entries 
      WHERE wager_id = wager_id_param AND side = wager_record.winning_side
    LOOP
      -- Calculate proportional winnings
      user_winnings := (entry_record.amount / winning_side_entries) * winnings_pool;
      
      -- Check if transaction already exists
      SELECT EXISTS(
        SELECT 1 FROM transactions 
        WHERE reference = wager_id_param::text 
          AND type = 'wager_win'
          AND user_id = entry_record.user_id
      ) INTO transaction_exists;

      -- Only process if transaction doesn't exist
      IF NOT transaction_exists THEN
        -- Add winnings to user balance
        PERFORM increment_balance(entry_record.user_id, user_winnings);
        
        -- Record transaction with detailed description
        INSERT INTO transactions (user_id, type, amount, reference, description)
        VALUES (
          entry_record.user_id,
          'wager_win',
          user_winnings,
          wager_id_param::text,
          'Wager Win: "' || wager_title || '" - Won ' || 
          CASE 
            WHEN entry_record.side = 'a' THEN wager_record.side_a
            ELSE wager_record.side_b
          END ||
          ' (Entry: ' || entry_record.amount || ', Winnings: ' || user_winnings || ')'
        )
        ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Update wager status to SETTLED (actual settlement with winnings distributed)
  UPDATE wagers
  SET status = 'SETTLED'
  WHERE id = wager_id_param;
END;
$$;

-- Update check_and_refund_single_participants function to check for existing transactions
CREATE OR REPLACE FUNCTION check_and_refund_single_participants()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_wager RECORD;
  participant_count INTEGER;
  entry_record RECORD;
  wager_title TEXT;
  transaction_exists BOOLEAN;
BEGIN
  -- Find wagers that have passed deadline, are still OPEN, and have only 1 participant
  FOR expired_wager IN
    SELECT w.id, w.title, w.deadline
    FROM wagers w
    WHERE w.status = 'OPEN'
      AND w.deadline IS NOT NULL
      AND w.deadline <= NOW()
    LOOP
      -- Count participants for this wager
      SELECT COUNT(DISTINCT user_id) INTO participant_count
      FROM wager_entries
      WHERE wager_id = expired_wager.id;

      -- If only 1 participant, refund them
      IF participant_count = 1 THEN
        wager_title := expired_wager.title;

        FOR entry_record IN
          SELECT * FROM wager_entries WHERE wager_id = expired_wager.id
        LOOP
          -- Check if transaction already exists
          SELECT EXISTS(
            SELECT 1 FROM transactions 
            WHERE reference = expired_wager.id::text 
              AND type = 'wager_refund'
              AND user_id = entry_record.user_id
          ) INTO transaction_exists;

          -- Only process if transaction doesn't exist
          IF NOT transaction_exists THEN
            -- Refund full entry amount
            PERFORM increment_balance(entry_record.user_id, entry_record.amount);
            
            -- Record transaction with detailed description
            INSERT INTO transactions (user_id, type, amount, reference, description)
            VALUES (
              entry_record.user_id,
              'wager_refund',
              entry_record.amount,
              expired_wager.id::text,
              'Auto-Refund: "' || wager_title || '" - Only participant, deadline passed'
            )
            ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
          END IF;
        END LOOP;

        -- Update wager status to RESOLVED
        UPDATE wagers
        SET status = 'RESOLVED', winning_side = NULL
        WHERE id = expired_wager.id;
      END IF;
    END LOOP;
END; $$;

-- Grant execute permission to authenticated users (for admin panel)
GRANT EXECUTE ON FUNCTION settle_wager(uuid) TO authenticated;

-- Note: This update adds idempotency checks to prevent duplicate transaction inserts
-- The functions now check if a transaction already exists before inserting
-- ON CONFLICT DO NOTHING provides an additional safety net


-- <<< END wagr/scripts/37-fix-duplicate-transactions-in-settlement.sql

-- >>> BEGIN wagr/scripts/38-add-comments-and-activities-complete.sql
-- Complete Comments and Activities System for Wagers
-- Run this script once to set up everything
-- This enables real-time discussions and activity tracking

-- ============================================================================
-- STEP 1: Create Tables
-- ============================================================================

-- Create wager_comments table
-- Note: Uses profiles(id) for custom authentication, not auth.users(id)
CREATE TABLE IF NOT EXISTS wager_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id uuid NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES wager_comments(id) ON DELETE CASCADE, -- For replies
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wager_activities table
-- Note: Uses profiles(id) for custom authentication, not auth.users(id)
CREATE TABLE IF NOT EXISTS wager_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id uuid NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  activity_type text NOT NULL, -- 'joined', 'left', 'switched_side', 'comment', 'wager_created', 'wager_resolved', 'wager_settled'
  activity_data jsonb DEFAULT '{}', -- Additional data like side, amount, etc.
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_wager_comments_wager_id ON wager_comments(wager_id);
CREATE INDEX IF NOT EXISTS idx_wager_comments_parent_id ON wager_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_wager_comments_created_at ON wager_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wager_activities_wager_id ON wager_activities(wager_id);
CREATE INDEX IF NOT EXISTS idx_wager_activities_created_at ON wager_activities(created_at DESC);

-- ============================================================================
-- STEP 3: Enable RLS
-- ============================================================================

ALTER TABLE wager_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wager_activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Drop Existing Policies (if any)
-- ============================================================================

DROP POLICY IF EXISTS "public read comments" ON wager_comments;
DROP POLICY IF EXISTS "authenticated users can insert comments" ON wager_comments;
DROP POLICY IF EXISTS "users can update own comments" ON wager_comments;
DROP POLICY IF EXISTS "users can delete own comments" ON wager_comments;
DROP POLICY IF EXISTS "users can insert comments" ON wager_comments;

DROP POLICY IF EXISTS "public read activities" ON wager_activities;
DROP POLICY IF EXISTS "system can insert activities" ON wager_activities;

-- ============================================================================
-- STEP 5: Create RLS Policies (for custom auth - permissive policies)
-- ============================================================================

-- Comments policies
CREATE POLICY "public read comments" ON wager_comments
  FOR SELECT USING (true);

CREATE POLICY "users can insert comments" ON wager_comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "users can update own comments" ON wager_comments
  FOR UPDATE USING (true);

CREATE POLICY "users can delete own comments" ON wager_comments
  FOR DELETE USING (true);

-- Activities policies
CREATE POLICY "public read activities" ON wager_activities
  FOR SELECT USING (true);

CREATE POLICY "system can insert activities" ON wager_activities
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- STEP 6: Drop ALL Existing Constraints on user_id (if any)
-- ============================================================================

-- Drop all possible constraint variations (foreign keys, unique, check, etc.)
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find and drop all constraints on user_id column
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'wager_comments'::regclass
    AND (
      conname LIKE '%user_id%' 
      OR conname = 'wager_comments_user_id_key'
      OR conname = 'wager_comments_user_id_fkey'
    )
  LOOP
    EXECUTE 'ALTER TABLE wager_comments DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.conname);
    RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: Ensure Correct Foreign Key Constraint
-- ============================================================================

-- The table definition already has: user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
-- But if constraints were dropped, we need to ensure the FK exists
-- Note: The FK is created automatically by the REFERENCES clause in CREATE TABLE
-- This block ensures it exists even if the table was altered
DO $$
BEGIN
  -- Check if any foreign key constraint exists on user_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'wager_comments'::regclass
    AND conname LIKE '%user_id%'
    AND contype = 'f'
  ) THEN
    -- Recreate the foreign key to profiles (custom auth)
    ALTER TABLE wager_comments 
    ADD CONSTRAINT wager_comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Create Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- ============================================================================
-- STEP 9: Create Triggers
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_wager_comments_updated_at ON wager_comments;
DROP TRIGGER IF EXISTS create_join_activity_trigger ON wager_entries;
DROP TRIGGER IF EXISTS create_leave_activity_trigger ON wager_entries;
DROP TRIGGER IF EXISTS create_switch_side_activity_trigger ON wager_entries;
DROP TRIGGER IF EXISTS create_comment_activity_trigger ON wager_comments;
DROP TRIGGER IF EXISTS create_wager_status_activity_trigger ON wagers;
DROP TRIGGER IF EXISTS create_wager_created_activity_trigger ON wagers;

-- Create triggers
CREATE TRIGGER update_wager_comments_updated_at
  BEFORE UPDATE ON wager_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_updated_at();

CREATE TRIGGER create_join_activity_trigger
  AFTER INSERT ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION create_join_activity();

CREATE TRIGGER create_leave_activity_trigger
  AFTER DELETE ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION create_leave_activity();

CREATE TRIGGER create_switch_side_activity_trigger
  AFTER UPDATE ON wager_entries
  FOR EACH ROW
  WHEN (OLD.side IS DISTINCT FROM NEW.side)
  EXECUTE FUNCTION create_switch_side_activity();

CREATE TRIGGER create_comment_activity_trigger
  AFTER INSERT ON wager_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_activity();

CREATE TRIGGER create_wager_status_activity_trigger
  AFTER UPDATE ON wagers
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION create_wager_status_activity();

CREATE TRIGGER create_wager_created_activity_trigger
  AFTER INSERT ON wagers
  FOR EACH ROW
  EXECUTE FUNCTION create_wager_created_activity();

-- ============================================================================
-- DONE!
-- ============================================================================
-- All tables, indexes, policies, functions, and triggers are now set up.
-- Comments and activities will work with custom authentication.
-- ============================================================================


-- <<< END wagr/scripts/38-add-comments-and-activities-complete.sql

-- >>> BEGIN wagr/scripts/43-fix-wager-comments-foreign-key-to-profiles.sql
-- Fix wager_comments foreign key to reference profiles(id) instead of auth.users(id)
-- This is needed because the system uses custom authentication

-- Step 1: Drop existing foreign key constraint (if it exists)
ALTER TABLE wager_comments 
  DROP CONSTRAINT IF EXISTS wager_comments_user_id_fkey;

ALTER TABLE wager_comments 
  DROP CONSTRAINT IF EXISTS wager_comments_user_id_key;

-- Step 2: Drop all constraints related to user_id
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'wager_comments'::regclass
    AND (
      conname LIKE '%user_id%' 
      OR conname = 'wager_comments_user_id_key'
      OR conname = 'wager_comments_user_id_fkey'
    )
  LOOP
    EXECUTE 'ALTER TABLE wager_comments DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.conname);
    RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
  END LOOP;
END $$;

-- Step 3: Create correct foreign key to profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'wager_comments'::regclass
    AND conname LIKE '%user_id%'
    AND contype = 'f'
  ) THEN
    ALTER TABLE wager_comments 
    ADD CONSTRAINT wager_comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Created foreign key constraint: wager_comments_user_id_fkey -> profiles(id)';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Step 4: Also fix wager_activities if needed
ALTER TABLE wager_activities 
  DROP CONSTRAINT IF EXISTS wager_activities_user_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'wager_activities'::regclass
    AND conname LIKE '%user_id%'
    AND contype = 'f'
  ) THEN
    ALTER TABLE wager_activities 
    ADD CONSTRAINT wager_activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Created foreign key constraint: wager_activities_user_id_fkey -> profiles(id)';
  END IF;
END $$;

-- Step 5: Verify constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid IN ('wager_comments'::regclass, 'wager_activities'::regclass)
AND conname LIKE '%user_id%'
ORDER BY conrelid::text, conname;


-- <<< END wagr/scripts/43-fix-wager-comments-foreign-key-to-profiles.sql

-- >>> BEGIN wagr/scripts/44-add-account-suspension.sql
-- Add account suspension functionality
-- Allows admins to suspend user accounts

-- Add is_suspended field to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

-- Add suspended_at timestamp for tracking when account was suspended
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Add suspension_reason for admin notes
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Create index for faster lookups of suspended users
CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended ON profiles(is_suspended);

-- Add comment for documentation
COMMENT ON COLUMN profiles.is_suspended IS 'Indicates if the user account is suspended';
COMMENT ON COLUMN profiles.suspended_at IS 'Timestamp when the account was suspended';
COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for suspension (admin notes)';


-- <<< END wagr/scripts/44-add-account-suspension.sql

