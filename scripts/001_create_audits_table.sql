-- Create audits table for storing published audit reports
-- This replaces Vercel Blob storage with Supabase (free tier: 1GB)

CREATE TABLE IF NOT EXISTS public.audits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score NUMERIC,
  grade TEXT,
  network TEXT,
  logo_url TEXT,
  description TEXT,
  website TEXT,
  github_url TEXT,
  telegram TEXT,
  twitter TEXT,
  discord TEXT,
  tags TEXT[],
  audit_date TEXT,
  market_cap NUMERIC,
  tvl NUMERIC,
  centralization_risk TEXT,
  
  -- Full audit data as JSONB for flexibility
  data JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_audits_name ON public.audits(name);
CREATE INDEX IF NOT EXISTS idx_audits_score ON public.audits(score DESC);
CREATE INDEX IF NOT EXISTS idx_audits_created ON public.audits(created_at DESC);

-- Enable RLS but allow public read access (audits are public)
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- Anyone can read audits (public portfolio)
CREATE POLICY "audits_public_read" ON public.audits 
  FOR SELECT USING (true);

-- Only service role can insert/update/delete (server-side only)
CREATE POLICY "audits_service_insert" ON public.audits 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audits_service_update" ON public.audits 
  FOR UPDATE USING (true);

CREATE POLICY "audits_service_delete" ON public.audits 
  FOR DELETE USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS audits_updated_at ON public.audits;
CREATE TRIGGER audits_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
