"use server"

import { revalidatePath } from "next/cache"
import { getAuditById, mockAudits } from "@/lib/mock-db"
import type { AuditProject } from "@/lib/types"
import { hasEnoughEvidence } from "@/lib/verification"

const csv = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean)

export async function upsertAudit(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  if (!id || !name) return { ok: false, error: "id and name are required" }

  const evidence = { reportHash: String(formData.get("reportHash") ?? "").trim(), reviewerNames: csv(formData.get("reviewerNames")), ciArtifacts: csv(formData.get("ciArtifacts")), commitHash: String(formData.get("commitHash") ?? "").trim(), branch: String(formData.get("branch") ?? "main"), signedAt: new Date().toISOString(), attestationCount: Math.max(0, Number(formData.get("attestationCount") ?? 0)) }
  const verified = hasEnoughEvidence(evidence)
  const project: AuditProject = { id, name, ticker: String(formData.get("ticker") ?? "").trim(), network: String(formData.get("network") ?? "").trim(), category: String(formData.get("category") ?? "").trim(), score: verified ? Math.max(0, Math.min(100, Number(formData.get("score") ?? 0))) : 0, rating: verified ? String(formData.get("rating") ?? "PENDING") : "PENDING", status: verified ? "VERIFIED" : "PENDING", price: "$0.00", change24h: "+0.00%", marketCap: "$0", findings: { critical: 0, high: 0, medium: 0, low: 0 }, description: "Uploaded through admin flow.", evidence, riskLabel: "LOW", tags: [String(formData.get("category") ?? "Audit")] }
  const index = mockAudits.findIndex((item) => item.id === id)
  if (index >= 0) mockAudits[index] = project
  else mockAudits.push(project)
  revalidatePath("/")
  revalidatePath(`/audit/${id}`)
  return { ok: true, project }
}

export async function submitAttestation(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  const audit = await getAuditById(id)
  if (!audit) return { ok: false, error: "audit not found" }
  const signers = csv(formData.get("signers"))
  const evidence = { ...audit.evidence, reportHash: String(formData.get("reportHash") ?? audit.evidence.reportHash), reviewerNames: signers, attestationCount: signers.length }
  const verified = hasEnoughEvidence(evidence)
  const index = mockAudits.findIndex((item) => item.id === id)
  if (index >= 0) mockAudits[index] = { ...mockAudits[index], evidence, status: verified ? "VERIFIED" : "PENDING", score: verified ? mockAudits[index].score : 0, rating: verified ? mockAudits[index].rating : "PENDING" }
  revalidatePath("/")
  revalidatePath(`/audit/${id}`)
  return { ok: true }
}
