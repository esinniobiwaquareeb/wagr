-- Additional settings to make bills providers configurable/extendable
SELECT set_setting(
  'bills.default_provider',
  '"nellobyte"'::jsonb,
  'bills',
  'Default Bills Provider',
  'Key of the provider used for bills purchases',
  'string',
  true,
  false
);

SELECT set_setting(
  'bills.enabled_providers',
  '["nellobyte"]'::jsonb,
  'bills',
  'Enabled Bills Providers',
  'List of provider keys that can be used for bills purchases',
  'array',
  true,
  false
);

