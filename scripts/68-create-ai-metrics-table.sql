-- Create AI metrics table for tracking token usage, costs, and performance
-- This allows admins to track AI usage and make informed decisions

CREATE TABLE IF NOT EXISTS ai_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request identification
  request_type TEXT NOT NULL CHECK (request_type IN ('generation', 'settlement')),
  model TEXT NOT NULL,
  wager_id UUID REFERENCES wagers(id) ON DELETE SET NULL,
  
  -- Token usage
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  
  -- Performance metrics
  success BOOLEAN NOT NULL DEFAULT false,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  
  -- Generation-specific metrics
  wagers_generated INTEGER,
  categories JSONB, -- { "crypto": 2, "sports": 1, ... }
  
  -- Settlement-specific metrics
  winning_side TEXT CHECK (winning_side IN ('a', 'b', NULL)),
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  has_relevant_news BOOLEAN,
  news_articles_count INTEGER,
  
  -- Metadata
  request_metadata JSONB, -- Store additional context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_metrics_request_type ON ai_metrics(request_type);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_model ON ai_metrics(model);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_wager_id ON ai_metrics(wager_id);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_created_at ON ai_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_success ON ai_metrics(success);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_request_type_created_at ON ai_metrics(request_type, created_at);

-- Enable RLS (if using RLS)
ALTER TABLE ai_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view AI metrics
CREATE POLICY "Admins can view AI metrics" ON ai_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Policy: Service can insert AI metrics
CREATE POLICY "Service can insert AI metrics" ON ai_metrics
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE ai_metrics IS 'Tracks AI usage metrics including token consumption, costs, and performance for generation and settlement operations';
COMMENT ON COLUMN ai_metrics.request_type IS 'Type of AI request: generation (wager creation) or settlement (wager resolution)';
COMMENT ON COLUMN ai_metrics.categories IS 'JSON object mapping category names to counts (for generation requests)';
COMMENT ON COLUMN ai_metrics.estimated_cost IS 'Estimated cost in USD based on model pricing';
