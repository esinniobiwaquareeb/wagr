-- Data plans catalog for providers
CREATE TABLE IF NOT EXISTS data_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_code TEXT NOT NULL,
  network_name TEXT,
  plan_code TEXT NOT NULL,
  plan_label TEXT NOT NULL,
  plan_price NUMERIC NOT NULL,
  plan_description TEXT,
  raw_data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_plans_network_plan
  ON data_plans(network_code, plan_code);

ALTER TABLE data_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read data plans" ON data_plans;
CREATE POLICY "public read data plans"
  ON data_plans
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION update_data_plans_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_data_plans_timestamp_trigger ON data_plans;
CREATE TRIGGER update_data_plans_timestamp_trigger
  BEFORE UPDATE ON data_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_data_plans_timestamp();

