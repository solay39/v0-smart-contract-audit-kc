// Gate di pubblicazione LATO SERVER. Non si fida di nulla che dichiari il client:
// ricalcola hash del sorgente, hash del report, ancoraggio dei finding e artefatti.
import { validateReport, type ValidationError } from "@/core/audit-core/validate.mjs"

export type PublishDecision = {
  decision: "BLOCK" | "PUBLISH_AS_UNREVIEWED_DRAFT" | "PUBLISH"
  errors: ValidationError[]
  reportSha256?: string
  label: string
}

export interface PublishGateInput {
  auditReport?: any            // report.json sigillato (schema solay39.report/2)
  sourceText?: unknown         // sorgente analizzato
  artifacts?: Record<string, string> // path -> contenuto (utf8) degli artefatti citati in claims
}

export function evaluatePublish({ auditReport, sourceText, artifacts = {} }: PublishGateInput): PublishDecision {
  const block = (errors: ValidationError[]): PublishDecision => ({ decision: "BLOCK", errors, label: "BLOCKED" })

  if (!auditReport || typeof auditReport !== "object") return block([{ code: "MISSING_REPORT", msg: "auditReport mancante" }])
  if (typeof sourceText !== "string" || !sourceText) return block([{ code: "MISSING_SOURCE", msg: "sourceText mancante" }])
  if (!auditReport.integrity?.report_sha256) return block([{ code: "NOT_SEALED", msg: "report non sigillato (integrity.report_sha256)" }])

  const v = validateReport(auditReport, {
    sourceText,
    readArtifact: (p) => (Object.prototype.hasOwnProperty.call(artifacts, p) ? artifacts[p] : null),
  })
  if (!v.ok) return block(v.errors)

  const reportSha256 = auditReport.integrity.report_sha256 as string
  if (v.publishable) return { decision: "PUBLISH", errors: [], reportSha256, label: "REVIEWED" }
  if (auditReport.status === "AUTOMATED_SCAN_PENDING_REVIEW") {
    return { decision: "PUBLISH_AS_UNREVIEWED_DRAFT", errors: [], reportSha256, label: "AUTOMATED SCAN - NOT MANUALLY REVIEWED" }
  }
  return block([{ code: "NOT_PUBLISHABLE", msg: "report non pubblicabile e non marcato come scansione automatica" }])
}
