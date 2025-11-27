-- Allow platform settings to store NULL JSON values (e.g., optional strings)
ALTER TABLE platform_settings
  ALTER COLUMN value DROP NOT NULL;

