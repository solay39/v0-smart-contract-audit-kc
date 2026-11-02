import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { auditId, reportHash, signers } = body
    if (!auditId || !reportHash || !Array.isArray(signers) || signers.length < 2) return NextResponse.json({ ok: false, error: "auditId, reportHash and at least 2 signers required" }, { status: 400 })
    if (!signers.every((signer: unknown) => typeof signer === "object" && signer !== null && "name" in signer && "role" in signer)) return NextResponse.json({ ok: false, error: "each signer must include name and role" }, { status: 400 })
    return NextResponse.json({ ok: true, attestation: { auditId, reportHash, signers, timestamp: new Date().toISOString() } })
  } catch { return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 }) }
}
