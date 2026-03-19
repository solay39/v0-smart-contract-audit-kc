import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    supabaseUrl: supabaseUrl ? "configured" : "MISSING",
    serviceKey: supabaseKey ? "configured" : "MISSING",
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ...result, error: "Missing Supabase credentials" })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Test connection by listing audits
  try {
    const { data, error, count } = await supabase
      .from("audits")
      .select("id, name", { count: "exact" })
      .limit(5)

    if (error) {
      result.connectionError = error.message
      result.hint = error.hint || null
      
      // If table doesn't exist, show how to create it
      if (error.message.includes("does not exist") || error.code === "42P01") {
        result.tableExists = false
        result.createTableSQL = `
-- Run this in Supabase SQL Editor:
CREATE TABLE public.audits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audits_select" ON public.audits FOR SELECT USING (true);
CREATE POLICY "audits_insert" ON public.audits FOR INSERT WITH CHECK (true);
CREATE POLICY "audits_update" ON public.audits FOR UPDATE USING (true);
CREATE POLICY "audits_delete" ON public.audits FOR DELETE USING (true);
        `.trim()
      }
    } else {
      result.connectionOk = true
      result.tableExists = true
      result.auditCount = count
      result.sampleAudits = data?.map(a => ({ id: a.id, name: a.name })) || []
    }
  } catch (e) {
    result.unexpectedError = e instanceof Error ? e.message : String(e)
  }

  // Test write (only if table exists)
  if (result.tableExists) {
    try {
      const testId = `test-${Date.now()}`
      const { error: writeError } = await supabase
        .from("audits")
        .upsert({
          id: testId,
          name: "Test Audit",
          data: { id: testId, name: "Test Audit", test: true }
        })

      if (writeError) {
        result.writeError = writeError.message
      } else {
        result.writeOk = true
        // Clean up test
        await supabase.from("audits").delete().eq("id", testId)
      }
    } catch (e) {
      result.writeException = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json(result)
}
