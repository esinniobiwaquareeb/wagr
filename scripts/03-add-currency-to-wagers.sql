-- Add currency column to wagers table
alter table wagers add column if not exists currency text default 'NGN';

-- Update existing wagers to have default currency
update wagers set currency = 'NGN' where currency is null;

