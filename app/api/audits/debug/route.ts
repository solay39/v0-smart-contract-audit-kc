import { list } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function GET() {
  const FOUNDER_KEY = process.env.SOLAY39_FOUNDER_KEY || "Solay39!Audit#2025"
  const hasEnvKey = !!process.env.SOLAY39_FOUNDER_KEY
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN

  // Test blob connection
  let blobOk = false
  let blobError = ""
  let blobCount = 0
  try {
    const { blobs } = await list({ prefix: "audits/" })
    blobOk = true
    blobCount = blobs.length
  } catch (e) {
    blobError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    auth: {
      activeKeyLength: FOUNDER_KEY.length,
      activeKeyPreview: FOUNDER_KEY.slice(0, 4) + "..." + FOUNDER_KEY.slice(-4),
      usingEnvVar: hasEnvKey,
      usingFallback: !hasEnvKey,
      envKeyMatchesFallback: hasEnvKey
        ? process.env.SOLAY39_FOUNDER_KEY === "Solay39!Audit#2025"
        : "n/a (using fallback)",
    },
    blob: {
      tokenConfigured: hasBlobToken,
      connectionOk: blobOk,
      auditCount: blobCount,
      error: blobError || null,
    },
  })
}
