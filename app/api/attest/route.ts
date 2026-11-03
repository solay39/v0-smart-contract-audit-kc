import { NextResponse } from "next/server"

// An attestation is only valid after signer identities and signatures over the
// exact report hash have been cryptographically verified and durably recorded.
// This demo endpoint does neither, so it must not return a successful attestation.
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "attestation_verification_unavailable",
      message: "Attestation submission is disabled until signature verification and durable storage are configured.",
    },
    { status: 501 },
  )
}
