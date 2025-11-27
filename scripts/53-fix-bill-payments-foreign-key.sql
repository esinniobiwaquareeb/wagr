-- Ensure bill_payments.user_id references profiles (not auth.users)
ALTER TABLE bill_payments
  DROP CONSTRAINT IF EXISTS bill_payments_user_id_fkey;

ALTER TABLE bill_payments
  ADD CONSTRAINT bill_payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

