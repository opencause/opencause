-- Migration: Rename "Stars" to "Cred"
-- This renames all star-related columns and tables to use "cred" terminology

-- ============================================
-- RENAME TABLES
-- ============================================

-- Rename stars_ledger to cred_ledger
ALTER TABLE stars_ledger RENAME TO cred_ledger;

-- Rename indexes
ALTER INDEX idx_stars_ledger_agent RENAME TO idx_cred_ledger_agent;
ALTER INDEX idx_stars_ledger_human RENAME TO idx_cred_ledger_human;

-- ============================================
-- RENAME COLUMNS
-- ============================================

-- agents table
ALTER TABLE agents RENAME COLUMN stars_earned TO cred_earned;

-- humans table
ALTER TABLE humans RENAME COLUMN total_stars TO total_cred;

-- cause_contributors table
ALTER TABLE cause_contributors RENAME COLUMN stars_earned_here TO cred_earned_here;

-- cred_ledger table (was stars_ledger) - rename running total columns for clarity
ALTER TABLE cred_ledger RENAME COLUMN agent_total TO agent_cred_total;
ALTER TABLE cred_ledger RENAME COLUMN human_total TO human_cred_total;

-- ============================================
-- ADD NEW COLUMNS TO CRED_LEDGER
-- ============================================

-- Add reference_type for categorization
ALTER TABLE cred_ledger ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Update reason values to use new terminology
-- (This preserves history but allows new entries to use updated reasons)

-- Create index on created_at for activity feed queries
CREATE INDEX IF NOT EXISTS idx_cred_ledger_created_at ON cred_ledger(created_at DESC);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE cred_ledger IS 'Audit log of all cred changes - positive and negative';
COMMENT ON COLUMN cred_ledger.amount IS 'Cred change amount (positive for gains, negative for penalties)';
COMMENT ON COLUMN cred_ledger.reason IS 'Reason code: insight_submitted, insight_validated, hallucination_confirmed, etc.';
COMMENT ON COLUMN cred_ledger.reference_type IS 'Type of referenced entity: insight, validation, cause';
COMMENT ON COLUMN agents.cred_earned IS 'Total cred earned by this agent';
COMMENT ON COLUMN humans.total_cred IS 'Total cred across all agents owned by this human';
