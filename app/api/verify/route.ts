import { list } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 })
  }

  try {
    const { blobs } = await list({ prefix: `audits/${id}.json` })

    if (blobs.length === 0) {
      return NextResponse.json({ found: false, error: "Audit not found" }, { status: 404 })
    }

    const res = await fetch(blobs[0].url)
    if (!res.ok) {
      return NextResponse.json({ found: false, error: "Failed to fetch audit" }, { status: 500 })
    }

    const audit = await res.json()

    // Extract stored integrity data
    const storedIntegrity = audit.reportIntegrity || null

    // Strip reportIntegrity to recompute hash on the original payload
    const { reportIntegrity: _strip, ...auditWithoutIntegrity } = audit
    const originalJson = JSON.stringify(auditWithoutIntegrity)

    // Compute SHA-256 server-side
    const encoder = new TextEncoder()
    const data = encoder.encode(originalJson)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const recomputedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("")

    const hashMatch = storedIntegrity?.sha256 === recomputedHash

    return NextResponse.json({
      found: true,
      auditId: audit.id,
      contractName: audit.name || "Unknown",
      chain: audit.chain || "Unknown",
      score: audit.score ?? null,
      publishDate: storedIntegrity?.timestamp || audit.date || null,
      storedHash: storedIntegrity?.sha256 || null,
      recomputedHash,
      hashMatch,
      auditorSignature: storedIntegrity?.auditorSignature || null,
      findingsCount: {
        critical: audit.findings?.filter((f: { severity: string }) => f.severity === "CRITICAL").length ?? 0,
        high: audit.findings?.filter((f: { severity: string }) => f.severity === "HIGH").length ?? 0,
        medium: audit.findings?.filter((f: { severity: string }) => f.severity === "MEDIUM").length ?? 0,
        low: audit.findings?.filter((f: { severity: string }) => f.severity === "LOW").length ?? 0,
        info: audit.findings?.filter((f: { severity: string }) => f.severity === "INFO").length ?? 0,
      },
    })
  } catch (error) {
    console.error("Verify error:", error)
    return NextResponse.json({ found: false, error: "Internal error" }, { status: 500 })
  }
}
