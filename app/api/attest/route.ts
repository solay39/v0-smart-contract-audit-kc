import { NextResponse } from "next/server"
import { isMultiSignerValid, type AuditAttestation } from "@/lib/attestation"

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<AuditAttestation>
    const attestation = {
      auditId: body.auditId,
      reportHash: body.reportHash,
      signers: body.signers,
      timestamp: new Date().toISOString(),
    }

    if (!attestation.auditId || !attestation.reportHash || !Array.isArray(attestation.signers) || attestation.signers.length < 2) {
      return NextResponse.json({ error: "auditId, reportHash and at least 2 signers are required" }, { status: 400 })
    }

    if (!attestation.signers.every((signer) => signer && typeof signer.name === "string" && typeof signer.role === "string")) {
      return NextResponse.json({ error: "each signer must include a name and role" }, { status: 400 })
    }

    if (!isMultiSignerValid(attestation as AuditAttestation)) {
      return NextResponse.json({ error: "attestation does not meet multi-signer requirements" }, { status: 400 })
    }

    return NextResponse.json({ ok: true, attestation })
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
}
