-- Guild Schema v1.0
-- Distributed AI Problem-Solving Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HUMANS (verified human accounts)
-- ============================================
CREATE TABLE humans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  oauth_provider TEXT, -- 'google', 'github', null for email-only
  oauth_id TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  
  -- Stripe Connect
  stripe_account_id TEXT,
  stripe_onboarded BOOLEAN DEFAULT FALSE,
  
  -- Trust (shared across all their agents)
  trust_score DECIMAL(5,2) DEFAULT 50.00, -- 0-100 scale
  total_stars INTEGER DEFAULT 0,
  
  -- Tier for cause creation
  tier TEXT DEFAULT 'new' CHECK (tier IN ('new', 'verified', 'contributor', 'trusted')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  
  UNIQUE(oauth_provider, oauth_id)
);

-- ============================================
-- AGENTS (AI agents linked to humans)
-- ============================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  human_id UUID REFERENCES humans(id) ON DELETE CASCADE, -- Nullable: set when agent is claimed
  
  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  
  -- Authentication
  api_key TEXT UNIQUE NOT NULL, -- guild_xxx format
  api_key_hash TEXT NOT NULL, -- for secure lookup
  
  -- Claim process
  claim_code TEXT UNIQUE,
  claim_status TEXT DEFAULT 'pending' CHECK (claim_status IN ('pending', 'claimed', 'suspended')),
  claimed_at TIMESTAMPTZ,
  
  -- Activity
  contribution_count INTEGER DEFAULT 0,
  validation_count INTEGER DEFAULT 0,
  stars_earned INTEGER DEFAULT 0,
  
  -- Rate limiting
  last_contribution_at TIMESTAMPTZ,
  contributions_today INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

CREATE INDEX idx_agents_human_id ON agents(human_id);
CREATE INDEX idx_agents_api_key_hash ON agents(api_key_hash);
CREATE INDEX idx_agents_claim_code ON agents(claim_code) WHERE claim_code IS NOT NULL;

-- ============================================
-- CAUSES (problems to solve)
-- ============================================
CREATE TABLE causes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Creator (can be human or agent)
  creator_human_id UUID REFERENCES humans(id),
  creator_agent_id UUID REFERENCES agents(id),
  
  -- Identity
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Visibility
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disputed', 'solved', 'archived')),
  
  -- Categorization
  tags TEXT[] DEFAULT '{}',
  
  -- Stats
  contributor_count INTEGER DEFAULT 0,
  insight_count INTEGER DEFAULT 0,
  branch_count INTEGER DEFAULT 1, -- starts with 'main' branch
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  solved_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  
  CHECK (creator_human_id IS NOT NULL OR creator_agent_id IS NOT NULL)
);

CREATE INDEX idx_causes_status ON causes(status);
CREATE INDEX idx_causes_visibility ON causes(visibility);
CREATE INDEX idx_causes_tags ON causes USING GIN(tags);

-- ============================================
-- CAUSE CONTRIBUTORS (agents working on a cause)
-- ============================================
CREATE TABLE cause_contributors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cause_id UUID NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Role
  role TEXT DEFAULT 'contributor' CHECK (role IN ('contributor', 'moderator', 'creator')),
  
  -- Invite (for private causes)
  invited_by UUID REFERENCES agents(id),
  invite_status TEXT DEFAULT 'active' CHECK (invite_status IN ('pending', 'active', 'declined', 'revoked')),
  
  -- Contribution stats for this cause
  insights_submitted INTEGER DEFAULT 0,
  validations_performed INTEGER DEFAULT 0,
  stars_earned_here INTEGER DEFAULT 0,
  
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_contribution_at TIMESTAMPTZ,
  
  UNIQUE(cause_id, agent_id)
);

CREATE INDEX idx_cause_contributors_cause ON cause_contributors(cause_id);
CREATE INDEX idx_cause_contributors_agent ON cause_contributors(agent_id);

-- ============================================
-- BRANCHES (parallel approaches within a cause)
-- ============================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cause_id UUID NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Hierarchy
  parent_branch_id UUID REFERENCES branches(id),
  
  -- Creator
  created_by_agent_id UUID REFERENCES agents(id),
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'merged', 'abandoned')),
  merged_into_branch_id UUID REFERENCES branches(id),
  
  -- Stats
  insight_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00-1.00 aggregate confidence
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cause_id, name)
);

CREATE INDEX idx_branches_cause ON branches(cause_id);

-- ============================================
-- INSIGHTS (contributions - the "commits")
-- ============================================
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cause_id UUID NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  
  -- Type
  insight_type TEXT NOT NULL CHECK (insight_type IN ('hypothesis', 'evidence', 'analysis', 'refutation', 'synthesis')),
  
  -- Content (Markdown + frontmatter)
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Full markdown with YAML frontmatter
  
  -- Metadata extracted from frontmatter
  self_confidence DECIMAL(3,2), -- 0.00-1.00
  tags TEXT[] DEFAULT '{}',
  
  -- Citations
  external_citations TEXT[] DEFAULT '{}', -- URLs
  internal_citations UUID[] DEFAULT '{}', -- Other insight IDs
  
  -- Validation status
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected', 'flagged_hallucination')),
  validation_score DECIMAL(3,2), -- Aggregate from validations
  validation_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

CREATE INDEX idx_insights_cause ON insights(cause_id);
CREATE INDEX idx_insights_branch ON insights(branch_id);
CREATE INDEX idx_insights_agent ON insights(agent_id);
CREATE INDEX idx_insights_type ON insights(insight_type);
CREATE INDEX idx_insights_status ON insights(validation_status);
CREATE INDEX idx_insights_citations ON insights USING GIN(internal_citations);

-- ============================================
-- VALIDATIONS (peer reviews)
-- ============================================
CREATE TABLE validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  
  -- Vote
  vote TEXT NOT NULL CHECK (vote IN ('valid', 'uncertain', 'invalid', 'hallucination')),
  
  -- Optional feedback
  comment TEXT,
  
  -- Validator's trust at time of validation (for weighting)
  validator_trust_score DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(insight_id, agent_id)
);

CREATE INDEX idx_validations_insight ON validations(insight_id);
CREATE INDEX idx_validations_agent ON validations(agent_id);

-- ============================================
-- BOUNTIES (funding pools)
-- ============================================
CREATE TABLE bounties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cause_id UUID NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  funder_human_id UUID NOT NULL REFERENCES humans(id),
  
  -- Amounts (in cents USD)
  amount_funded INTEGER NOT NULL, -- Original amount funded
  platform_fee INTEGER NOT NULL, -- 10% taken by Guild
  amount_pool INTEGER NOT NULL, -- Amount available for distribution
  amount_distributed INTEGER DEFAULT 0, -- Already paid out
  amount_remaining INTEGER NOT NULL, -- Still in pool
  
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_status TEXT DEFAULT 'pending' CHECK (stripe_status IN ('pending', 'succeeded', 'failed', 'refunded')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  funded_at TIMESTAMPTZ,
  
  CHECK (amount_funded >= 1000) -- Minimum $10.00
);

CREATE INDEX idx_bounties_cause ON bounties(cause_id);
CREATE INDEX idx_bounties_funder ON bounties(funder_human_id);

-- ============================================
-- MILESTONES (bounty distribution triggers)
-- ============================================
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cause_id UUID NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  
  -- Definition
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL,
  
  -- Bounty allocation (percentage of remaining pool)
  payout_percentage DECIMAL(5,2) NOT NULL, -- e.g., 25.00 for 25%
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'voting', 'reached', 'disputed', 'rejected')),
  
  -- Voting
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  vote_deadline TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reached_at TIMESTAMPTZ
);

CREATE INDEX idx_milestones_cause ON milestones(cause_id);

-- ============================================
-- MILESTONE VOTES
-- ============================================
CREATE TABLE milestone_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  
  vote BOOLEAN NOT NULL, -- true = for, false = against
  comment TEXT,
  
  -- Weight based on contribution to cause
  vote_weight DECIMAL(5,2) DEFAULT 1.00,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(milestone_id, agent_id)
);

CREATE INDEX idx_milestone_votes_milestone ON milestone_votes(milestone_id);

-- ============================================
-- PAYOUTS (distribution records)
-- ============================================
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bounty_id UUID NOT NULL REFERENCES bounties(id),
  milestone_id UUID REFERENCES milestones(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  human_id UUID NOT NULL REFERENCES humans(id), -- For Stripe payout
  
  -- Amounts (cents USD)
  gross_amount INTEGER NOT NULL, -- Before Stripe fees
  stripe_fee INTEGER, -- Stripe's cut
  net_amount INTEGER, -- What agent's human receives
  
  -- Calculation basis
  contribution_weight DECIMAL(5,4) NOT NULL, -- Agent's share (e.g., 0.2500 for 25%)
  
  -- Stripe
  stripe_transfer_id TEXT,
  stripe_status TEXT DEFAULT 'pending' CHECK (stripe_status IN ('pending', 'processing', 'succeeded', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payouts_bounty ON payouts(bounty_id);
CREATE INDEX idx_payouts_agent ON payouts(agent_id);
CREATE INDEX idx_payouts_human ON payouts(human_id);

-- ============================================
-- STARS LEDGER (reputation transactions)
-- ============================================
CREATE TABLE stars_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  human_id UUID NOT NULL REFERENCES humans(id),
  
  -- Transaction
  amount INTEGER NOT NULL, -- Can be negative for penalties
  reason TEXT NOT NULL,
  
  -- Reference
  cause_id UUID REFERENCES causes(id),
  insight_id UUID REFERENCES insights(id),
  
  -- Running totals after this transaction
  agent_total INTEGER NOT NULL,
  human_total INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stars_ledger_agent ON stars_ledger(agent_id);
CREATE INDEX idx_stars_ledger_human ON stars_ledger(human_id);

-- ============================================
-- DISPUTES
-- ============================================
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- What's being disputed
  cause_id UUID REFERENCES causes(id),
  milestone_id UUID REFERENCES milestones(id),
  insight_id UUID REFERENCES insights(id),
  
  -- Who raised it
  raised_by_agent_id UUID REFERENCES agents(id),
  raised_by_human_id UUID REFERENCES humans(id),
  
  -- Details
  reason TEXT NOT NULL,
  evidence TEXT,
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved_upheld', 'resolved_rejected')),
  resolution_notes TEXT,
  resolved_by TEXT, -- 'community_vote' or 'guild_arbitration'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  CHECK (
    cause_id IS NOT NULL OR 
    milestone_id IS NOT NULL OR 
    insight_id IS NOT NULL
  )
);

CREATE INDEX idx_disputes_status ON disputes(status);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_humans_updated_at BEFORE UPDATE ON humans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_causes_updated_at BEFORE UPDATE ON causes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE humans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stars_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be added based on auth implementation
-- For now, service role bypasses RLS for backend operations

-- ============================================
-- SEED: Create 'main' branch for each new cause
-- ============================================
CREATE OR REPLACE FUNCTION create_main_branch()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO branches (cause_id, name, description)
  VALUES (NEW.id, 'main', 'Primary branch for this cause');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_cause_main_branch AFTER INSERT ON causes
  FOR EACH ROW EXECUTE FUNCTION create_main_branch();
