import { put, list, del } from "@vercel/blob"
import { NextResponse } from "next/server"

// Test endpoint to verify Blob is working
export async function GET() {
  const testId = `test-${Date.now()}`
  const testData = { id: testId, name: "Test Audit", timestamp: new Date().toISOString() }
  
  try {
    // Step 1: Try to save
    console.log("[v0] Testing Blob - Step 1: PUT")
    const blob = await put(`audits/${testId}.json`, JSON.stringify(testData), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    })
    console.log("[v0] PUT success:", blob.url)
    
    // Step 2: Try to list
    console.log("[v0] Testing Blob - Step 2: LIST")
    const { blobs } = await list({ prefix: "audits/" })
    console.log("[v0] LIST found:", blobs.length, "blobs")
    
    // Step 3: Try to fetch the saved blob
    console.log("[v0] Testing Blob - Step 3: FETCH")
    const res = await fetch(blob.url)
    const fetchedData = await res.json()
    console.log("[v0] FETCH success:", fetchedData)
    
    // Step 4: Clean up - delete test blob
    console.log("[v0] Testing Blob - Step 4: DELETE")
    await del(blob.url)
    console.log("[v0] DELETE success")
    
    return NextResponse.json({
      success: true,
      steps: {
        put: { success: true, url: blob.url },
        list: { success: true, count: blobs.length, blobs: blobs.map(b => b.pathname) },
        fetch: { success: true, data: fetchedData },
        delete: { success: true },
      },
      message: "Blob is working correctly!"
    })
  } catch (error) {
    console.error("[v0] Blob test error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
