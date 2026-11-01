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
  const reportStatus = String(data.report_status ?? data.reportStatus ?? "").toUpperCase()
  const manualReviewStatus = String(data.manual_review_status ?? data.manualReviewStatus ?? "").toUpperCase()
  const productionReadyFlag = data.production_ready === true || data.productionReady === true
  const evidence = (data.evidence || {}) as UnknownRecord
  const reviewerNames = Array.isArray(data.reviewer_names) ? data.reviewer_names : []
  const summaryText = `${String(data.summary ?? "")} ${String(data.executive_summary ?? "")}`.toLowerCase()
  const text = collectText(data).toLowerCase()

  if (reportStatus && !["DRAFT", "PRELIMINARY", "PUBLISHED"].includes(reportStatus)) blockers.push("report_status must be DRAFT, PRELIMINARY, or PUBLISHED.")
  if (manualReviewStatus && !["NOT_PERFORMED", "PARTIAL", "FULL"].includes(manualReviewStatus)) blockers.push("manual_review_status must be NOT_PERFORMED, PARTIAL, or FULL.")
  if (manualReviewStatus === "FULL") {
    if (reviewerNames.length === 0) blockers.push("manual_review_status=FULL requires reviewer_names.")
    if (!hasValue(data.review_scope)) blockers.push("manual_review_status=FULL requires review_scope.")
    if (!data.manual_review_evidence && !data.manualReviewEvidence) blockers.push("manual_review_status=FULL requires manual_review_evidence.")
  }
  if (productionReadyFlag) {
    if (reportStatus !== "PUBLISHED") blockers.push("production_ready requires report_status=PUBLISHED.")
    if (manualReviewStatus !== "FULL") blockers.push("production_ready requires manual_review_status=FULL.")
    if (reviewerNames.length === 0) blockers.push("production_ready requires reviewer_names.")
    if (!Array.isArray(evidence.ci_artifacts) || evidence.ci_artifacts.length === 0) blockers.push("production_ready requires evidence.ci_artifacts.")
  }
  const tests = evidence.tests as UnknownRecord | undefined
  if (tests && (tests.passed !== undefined || tests.total !== undefined)) {
    if (!Array.isArray(evidence.test_logs) || evidence.test_logs.length === 0) blockers.push("Test metrics require evidence.test_logs.")
    if (!Array.isArray(evidence.ci_artifacts) || evidence.ci_artifacts.length === 0) blockers.push("Test metrics require evidence.ci_artifacts.")
  }
  if (/96\/96/.test(summaryText) && (!Array.isArray(evidence.test_logs) || evidence.test_logs.length === 0)) blockers.push("96/96 claim requires evidence.test_logs.")
  if (summaryText.includes("production ready") && !productionReadyFlag) blockers.push("Summary claims production ready while production_ready is false.")
  if (summaryText.includes("manual review full") && manualReviewStatus !== "FULL") blockers.push("Summary claims full manual review while status disagrees.")
  const finalAssessment = (data.finalAssessment || {}) as UnknownRecord
  const methodology = (data.testingMethodology || {}) as UnknownRecord
  const team = findReviewTeam(data)
  const reviewer = (team.leadAuditor || team.reviewer || {}) as UnknownRecord
  const integrity = (data.reportIntegrity || data.integrity || {}) as UnknownRecord
  const artifacts = integrity.artifacts as UnknownRecord | undefined

  const pendingManual = /pending manual review|manual review pending|not performed|not verified|automated analysis pending/.test(text)
  const productionReady = productionReadyFlag || /production ready|production-ready/.test(String(finalAssessment.productionReadiness || "").toLowerCase()) || /production ready|production-ready/.test(text)
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

  const findings = Array.isArray(data.findings) ? data.findings : []
  findings.forEach((finding, index) => {
    const item = (finding || {}) as UnknownRecord
    const severity = String(item.severity || "").toUpperCase()
    if (severity === "HIGH" || severity === "CRITICAL") {
      const proof = (item.proof || {}) as UnknownRecord
      if (!hasValue(proof.trigger)) blockers.push(`Finding ${index}: ${severity} finding requires proof.trigger.`)
      if (!hasValue(proof.artifact) && !hasValue(proof.fork_result)) blockers.push(`Finding ${index}: ${severity} finding requires proof.artifact or proof.fork_result.`)
    }
  })

  return { valid: blockers.length === 0, blockers, warnings }
}
