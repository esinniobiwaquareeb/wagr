-- Add 2FA fields to admins table
-- Add permission management support

ALTER TABLE admins
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[];

-- Create index for 2FA lookup
CREATE INDEX IF NOT EXISTS idx_admins_two_factor_enabled ON admins(two_factor_enabled) WHERE two_factor_enabled = true;

-- Ensure permissions column exists (should already exist, but make sure it's an array)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admins' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE admins ADD COLUMN permissions TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN admins.two_factor_enabled IS 'Whether 2FA is enabled for this admin';
COMMENT ON COLUMN admins.two_factor_secret IS 'TOTP secret for 2FA';
COMMENT ON COLUMN admins.two_factor_backup_codes IS 'Backup codes for 2FA recovery';

