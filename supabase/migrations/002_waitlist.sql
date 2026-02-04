-- Waitlist for early access signups
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'website', -- where they signed up from
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ -- when we sent them access
);

-- Allow public inserts (no auth required)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON waitlist
  FOR INSERT WITH CHECK (true);

-- Index for lookups
CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_created ON waitlist(created_at DESC);
