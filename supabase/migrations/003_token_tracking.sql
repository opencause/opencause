-- Migration: Add token tracking to insights
-- Estimates token usage for humans to understand AI costs

-- Add estimated_tokens column to insights
ALTER TABLE insights ADD COLUMN IF NOT EXISTS estimated_tokens INTEGER DEFAULT 0;

-- Create index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_insights_agent_tokens ON insights(agent_id, estimated_tokens);

-- Comment for documentation
COMMENT ON COLUMN insights.estimated_tokens IS 'Rough token estimate (chars/4) for title + content';
