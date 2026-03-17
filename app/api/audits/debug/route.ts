import { list } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function GET() {
  const FOUNDER_KEY = process.env.SOLAY39_FOUNDER_KEY || "Solay39!Audit#2025"
  const hasEnvKey = !!process.env.SOLAY39_FOUNDER_KEY
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN

  // Test blob connection and list all audits
  let blobOk = false
  let blobError = ""
  let auditList: { id: string; pathname: string; size: number; uploadedAt: string }[] = []
  
  try {
    const { blobs } = await list({ prefix: "audits/" })
    blobOk = true
    auditList = blobs
      .filter(b => b.pathname.endsWith('.json'))
      .map(b => ({
        id: b.pathname.replace('audits/', '').replace('.json', ''),
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt?.toISOString() || "unknown",
      }))
  } catch (e) {
    blobError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    status: blobOk ? "ok" : "error",
    auth: {
      activeKeyPreview: FOUNDER_KEY.slice(0, 4) + "..." + FOUNDER_KEY.slice(-4),
      usingEnvVar: hasEnvKey,
      usingFallback: !hasEnvKey,
    },
    blob: {
      tokenConfigured: hasBlobToken,
      connectionOk: blobOk,
      auditCount: auditList.length,
      error: blobError || null,
      audits: auditList,
    },
    help: {
      syncUrl: "Vai su solay39.eu -> ADMIN -> inserisci 'Solay39!Audit#2025' -> clicca 'SYNC ALL TO BLOB'",
    },
  })
}
