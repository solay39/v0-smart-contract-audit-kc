// Debug endpoint to check Blob storage contents
import { list } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { blobs } = await list({ prefix: "audits/" })
    
    return NextResponse.json({
      success: true,
      blobCount: blobs.length,
      blobs: blobs.map(b => ({
        pathname: b.pathname,
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
