export interface AuditReportValidation {
  valid: boolean
  blockers: string[]
  warnings: string[]
}

type UnknownRecord = Record<string, unknown>

function collectText(value: unknown, parts: string[] = []): string {
  if (typeof value === "string") parts.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, parts))
  else if (value && typeof value === "object") Object.values(value as UnknownRecord).forEach((item) => collectText(item, parts))
  return parts.join("\n")
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value)
}

function findReviewTeam(report: UnknownRecord): UnknownRecord {
  const engagement = report.engagement as UnknownRecord | undefined
  return (engagement?.reviewTeam as UnknownRecord | undefined) || {}
}

export function validateAuditReport(report: unknown): AuditReportValidation {
  const blockers: string[] = []
  const warnings: string[] = []
  if (!report || typeof report !== "object") return { valid: false, blockers: ["Audit report is missing or not an object."], warnings }

  const data = report as UnknownRecord
  const text = collectText(data).toLowerCase()
  const finalAssessment = (data.finalAssessment || {}) as UnknownRecord
  const methodology = (data.testingMethodology || {}) as UnknownRecord
  const team = findReviewTeam(data)
  const reviewer = (team.leadAuditor || team.reviewer || {}) as UnknownRecord
  const integrity = (data.reportIntegrity || data.integrity || {}) as UnknownRecord
  const artifacts = integrity.artifacts as UnknownRecord | undefined

  const pendingManual = /pending manual review|manual review pending|not performed|not verified|automated analysis pending/.test(text)
  const productionReady = /production ready|production-ready/.test(String(finalAssessment.productionReadiness || "").toLowerCase()) || /production ready|production-ready/.test(text)
  const fullManual = /full.*manual|line-by-line|independent review completed|dual review/.test(text)
  const signedOff = reviewer.signedOff === true && hasValue(reviewer.name) && !/pending|not verified/i.test(String(reviewer.name || ""))

  if (productionReady && (pendingManual || !signedOff)) blockers.push("Production-ready claim requires verified manual sign-off and no pending-review state.")
  if (fullManual && !signedOff) blockers.push("Manual or dual-review claim requires a named, signed-off reviewer.")

  const fuzzClaim = methodology.fuzzingApplied === true || /[0-9][0-9,]*\s*(fuzz runs|sequences)/i.test(text)
  const coverageClaim = hasValue(methodology.coverage) || /[0-9]{2,3}%\s*(coverage|test coverage)/i.test(text)
  if (fuzzClaim && !hasValue(methodology.fuzzingDetails) && !artifacts?.fuzzing && !artifacts?.foundry && !artifacts?.echidna) blockers.push("Fuzzing claim has no details or linked artifact.")
  if (coverageClaim && !artifacts?.coverage && !artifacts?.foundry && !artifacts?.ci) warnings.push("Coverage claim is missing a dedicated coverage artifact.")

  if (/manual review[^\n]{0,120}not performed/i.test(text) && fullManual) blockers.push("Report contradicts itself: manual review is both claimed and not performed.")
  if (/production readiness[^\n]{0,120}not assessed/i.test(text) && productionReady) blockers.push("Report contradicts itself: production readiness is both asserted and unassessed.")
  if (/recommendation[^\n]{0,120}recommended/i.test(text) && /not recommended/.test(text)) blockers.push("Report contains conflicting deployment recommendations.")

  const findingText = JSON.stringify(data.findings || data.vulnerabilities || []).toLowerCase()
  if (/delegatecall|upgrade|uups/.test(findingText) && !/delegatecall|upgrade|uups/.test(text)) warnings.push("Finding terminology could not be reconciled with report methodology; require manual evidence review.")

  const claimMetadata = data.claimEvidence as UnknownRecord | undefined
  if (claimMetadata && !claimMetadata.verified) blockers.push("Claim evidence is explicitly marked unverified.")

  return { valid: blockers.length === 0, blockers, warnings }
}
