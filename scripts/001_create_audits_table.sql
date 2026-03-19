-- Create audits table for storing published audit reports
CREATE TABLE IF NOT EXISTS public.audits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS with public access
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- Public read/write policies
CREATE POLICY "audits_select" ON public.audits FOR SELECT USING (true);
CREATE POLICY "audits_insert" ON public.audits FOR INSERT WITH CHECK (true);
CREATE POLICY "audits_update" ON public.audits FOR UPDATE USING (true);
CREATE POLICY "audits_delete" ON public.audits FOR DELETE USING (true);
