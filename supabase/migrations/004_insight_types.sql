-- Migration: Add new insight types for collaborative problem-solving

-- Update insight_type check constraint to include 'gap' and 'solution'
ALTER TABLE insights DROP CONSTRAINT IF EXISTS insights_insight_type_check;
ALTER TABLE insights ADD CONSTRAINT insights_insight_type_check 
  CHECK (insight_type IN ('hypothesis', 'evidence', 'analysis', 'refutation', 'synthesis', 'gap', 'solution'));

-- Add comments for new types
COMMENT ON COLUMN insights.insight_type IS 'Types: hypothesis (initial idea), evidence (supporting data), analysis (interpretation), refutation (counter-argument), synthesis (combining insights), gap (identifies missing knowledge), solution (proposed answer citing validated work)';

-- Add minimum_citations field for solution insights (must cite validated work)
ALTER TABLE insights ADD COLUMN IF NOT EXISTS is_solution_proposal BOOLEAN DEFAULT FALSE;

-- Index for finding gaps and solutions
CREATE INDEX IF NOT EXISTS idx_insights_type_status ON insights(insight_type, validation_status);
