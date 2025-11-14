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

