import { NextResponse } from "next/server"
import { analyzeSolidity } from "@/lib/security-intelligence"

export async function POST(request: Request) {
  try {
    const body = await request.json() as { source?: unknown }
    if (typeof body.source !== "string" || body.source.trim().length === 0) return NextResponse.json({ error: "Solidity source is required" }, { status: 400 })
    if (Buffer.byteLength(body.source, "utf8") > 500_000) return NextResponse.json({ error: "Source exceeds the 500 KB preview limit" }, { status: 413 })
    return NextResponse.json(analyzeSolidity(body.source), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Invalid audit request" }, { status: 400 })
  }
}
