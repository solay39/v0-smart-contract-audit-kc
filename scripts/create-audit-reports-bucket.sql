-- Create the audit-reports bucket for storing HTML reports
-- This bucket is public so reports can be downloaded without authentication

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audit-reports',
  'audit-reports', 
  true,
  10485760, -- 10MB max file size
  ARRAY['text/html', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for audit reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'audit-reports');

-- Allow authenticated users to upload
CREATE POLICY "Service role can upload audit reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audit-reports');

-- Allow service role to update (for upsert)
CREATE POLICY "Service role can update audit reports"
ON storage.objects FOR UPDATE
USING (bucket_id = 'audit-reports');
