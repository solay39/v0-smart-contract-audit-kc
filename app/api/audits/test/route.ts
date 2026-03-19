import { put, list } from "@vercel/blob"
import { NextResponse } from "next/server"

// Test endpoint to diagnose Blob issues
export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 10) + "...",
  }

  // Test 1: Can we list blobs?
  try {
    const { blobs } = await list({ prefix: "audits/" })
    results.listSuccess = true
    results.existingBlobs = blobs.length
    results.blobNames = blobs.slice(0, 5).map(b => b.pathname)
  } catch (e) {
    results.listSuccess = false
    results.listError = e instanceof Error ? e.message : String(e)
  }

  // Test 2: Can we write a test blob with public access?
  try {
    const testData = { test: true, timestamp: Date.now() }
    const blob = await put("audits/_test_public.json", JSON.stringify(testData), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    })
    results.publicWriteSuccess = true
    results.publicBlobUrl = blob.url
  } catch (e) {
    results.publicWriteSuccess = false
    results.publicWriteError = e instanceof Error ? e.message : String(e)
  }

  // Test 3: Can we write with private access?
  try {
    const testData = { test: true, timestamp: Date.now() }
    const blob = await put("audits/_test_private.json", JSON.stringify(testData), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
    })
    results.privateWriteSuccess = true
    results.privateBlobUrl = blob.url
  } catch (e) {
    results.privateWriteSuccess = false
    results.privateWriteError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(results, { status: 200 })
}
