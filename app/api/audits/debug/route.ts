import { list } from "@vercel/blob"
import { NextResponse } from "next/server"

// Debug endpoint to check Blob storage status
export async function GET() {
  try {
    const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN
    
    if (!hasBlobToken) {
      return NextResponse.json({
        status: "error",
        error: "BLOB_READ_WRITE_TOKEN not configured",
        audits: [],
      })
    }

    // List all audits in Blob
    const { blobs } = await list({ prefix: "audits/" })
    
    const audits = blobs
      .filter(b => b.pathname.endsWith('.json'))
      .map(b => ({
        id: b.pathname.replace('audits/', '').replace('.json', ''),
        pathname: b.pathname,
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt?.toISOString() || "unknown",
      }))

    return NextResponse.json({
      status: "ok",
      blobTokenConfigured: hasBlobToken,
      auditCount: audits.length,
      audits,
      help: "Go to Admin mode and click 'SYNC ALL TO CLOUD' to sync local audits to Blob storage",
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      audits: [],
    })
  }
}
