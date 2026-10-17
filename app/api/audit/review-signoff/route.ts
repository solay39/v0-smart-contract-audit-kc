import { createClient } from "@supabase/supabase-js"
import { verifyMessage } from "ethers"
import { createHash } from "crypto"

function canonicalMessage(input: { contractName: string; contractAddress: string; network: string; reviewedAt: string; checks: number; checksTotal: number; findings: number; findingsTotal: number; confirmed: number; manual: number }) {
  return [
    "Solay39 Manual Review Signature",
    `Contract: ${input.contractName} (${input.contractAddress})`,
    `Network: ${input.network}`,
    `Checks completed: ${input.checks}/${input.checksTotal}`,
    `AI findings reviewed: ${input.findings}/${input.findingsTotal}`,
    `Confirmed findings: ${input.confirmed}`,
    `Manual findings added: ${input.manual}`,
    `Reviewed at: ${input.reviewedAt}`,
    "I confirm I have manually reviewed this smart contract using the AI-guided checklist.",
  ].join("\n")
}

export async function POST(req: Request) {
  const body = await req.json() as { auditId?: string; session?: Record<string, unknown> }
  const session = body.session
  if (!body.auditId || !session?.signature || !session.auditorWallet) return Response.json({ error: "auditId, auditorWallet and signature are required" }, { status: 400 })
  const checks = Array.isArray(session.checks) ? session.checks : []
  const aiFindings = Array.isArray(session.aiFindings) ? session.aiFindings : []
  const manualFindings = Array.isArray(session.manualFindings) ? session.manualFindings : []
  const input = {
    contractName: String(session.contractName || ""), contractAddress: String(session.contractAddress || ""), network: String(session.network || ""),
    reviewedAt: String(session.completedAt || ""), checks: checks.filter((c) => (c as { status?: string }).status !== "pending").length, checksTotal: checks.length,
    findings: aiFindings.filter((f) => (f as { decision?: string }).decision !== "pending").length, findingsTotal: aiFindings.length,
    confirmed: aiFindings.filter((f) => ["confirmed", "modified"].includes((f as { decision?: string }).decision || "")).length, manual: manualFindings.length,
  }
  const message = canonicalMessage(input)
  let recovered: string
  try { recovered = verifyMessage(message, String(session.signature)) } catch { return Response.json({ error: "Invalid Ethereum signature" }, { status: 400 }) }
  if (recovered.toLowerCase() !== String(session.auditorWallet).toLowerCase()) return Response.json({ error: "Signature does not match auditor wallet" }, { status: 400 })
  const reviewHash = createHash("sha256").update(JSON.stringify({ message, signature: session.signature, session })).digest("hex")
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: audit, error: readError } = await supabase.from("audits").select("data").eq("id", body.auditId).single()
  if (readError || !audit) return Response.json({ error: "Audit not found" }, { status: 404 })
  const data = (audit.data || {}) as Record<string, unknown>
  const review = { ...session, signed: true, signatureVerified: true, recoveredWallet: recovered, reviewHash, signedAt: new Date().toISOString(), canonicalMessage: message }
  const { error } = await supabase.from("audits").update({ data: { ...data, manualReview: review, reviewStatus: "MANUALLY_REVIEWED_SIGNED" } }).eq("id", body.auditId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, reviewHash, recoveredWallet: recovered, status: "MANUALLY_REVIEWED_SIGNED" })
}
