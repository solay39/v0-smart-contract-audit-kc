-- SOLAY39 Skynet Real-time & Oracle Tables
-- Run this migration to enable real-time monitoring and on-chain oracle

-- ═══════════════════════════════════════════════════════════════════════════════
-- Skynet Subscriptions (contracts being monitored)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS skynet_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  audit_id TEXT,
  project_name TEXT,
  events TEXT[] DEFAULT ARRAY['Transfer', 'OwnershipTransferred', 'Paused', 'Upgraded'],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contract_address, chain)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_skynet_subs_active ON skynet_subscriptions(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_skynet_subs_chain ON skynet_subscriptions(chain);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Skynet Events (on-chain events captured)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS skynet_events (
  id TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  from_address TEXT,
  to_address TEXT,
  value TEXT,
  data JSONB,
  processed BOOLEAN DEFAULT false,
  alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_skynet_events_contract ON skynet_events(contract_address);
CREATE INDEX IF NOT EXISTS idx_skynet_events_chain ON skynet_events(chain);
CREATE INDEX IF NOT EXISTS idx_skynet_events_severity ON skynet_events(severity);
CREATE INDEX IF NOT EXISTS idx_skynet_events_timestamp ON skynet_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_skynet_events_block ON skynet_events(chain, block_number DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Oracle Publications (scores published on-chain)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS oracle_publications (
  id TEXT PRIMARY KEY,
  contract_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  rating TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  audit_id TEXT,
  report_hash TEXT,
  report_url TEXT,
  criticals INTEGER DEFAULT 0,
  highs INTEGER DEFAULT 0,
  mediums INTEGER DEFAULT 0,
  lows INTEGER DEFAULT 0,
  score_breakdown JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oracle_contract ON oracle_publications(contract_address);
CREATE INDEX IF NOT EXISTS idx_oracle_chain ON oracle_publications(chain);
CREATE INDEX IF NOT EXISTS idx_oracle_score ON oracle_publications(score);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Anti-Hacker Database (blocked wallets/IPs)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS anti_hacker_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('WALLET', 'IP', 'CONTRACT')),
  entity_value TEXT NOT NULL,
  chain TEXT,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM')),
  source TEXT, -- e.g., 'SKYNET_AUTO', 'MANUAL', 'COMMUNITY_REPORT'
  evidence JSONB,
  blocked_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  UNIQUE(entity_type, entity_value, chain)
);

CREATE INDEX IF NOT EXISTS idx_anti_hacker_active ON anti_hacker_blocks(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_anti_hacker_entity ON anti_hacker_blocks(entity_type, entity_value);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Security Registry (historical security events)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- e.g., 'EXPLOIT', 'RUG_PULL', 'AUDIT_REVOKED', 'VULNERABILITY_DISCLOSED'
  project_name TEXT,
  contract_address TEXT,
  chain TEXT,
  impact TEXT CHECK (impact IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  description TEXT NOT NULL,
  funds_lost TEXT, -- e.g., '$1.2M'
  tx_hashes TEXT[],
  references TEXT[], -- URLs to reports, articles
  discovered_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_registry_impact ON security_registry(impact);
CREATE INDEX IF NOT EXISTS idx_security_registry_chain ON security_registry(chain);
CREATE INDEX IF NOT EXISTS idx_security_registry_date ON security_registry(discovered_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS Policies (optional - uncomment if using Supabase Auth)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ALTER TABLE skynet_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE skynet_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE oracle_publications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE anti_hacker_blocks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE security_registry ENABLE ROW LEVEL SECURITY;

-- Allow public read access to oracle publications
-- CREATE POLICY "Public read oracle" ON oracle_publications FOR SELECT USING (true);

-- Allow public read access to security registry
-- CREATE POLICY "Public read security" ON security_registry FOR SELECT USING (true);
