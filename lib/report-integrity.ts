import type { AuditReportFields, ValidationIssue } from "@/lib/audit-validator"

export function checkProfessionalIntegrity(report: AuditReportFields): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (id: string, severity: ValidationIssue["severity"], field: string, expected: string, found: string, detail: string, fix: string) => {
    issues.push({ id, severity, field, expected, found, detail, fix, autoFixable: false })
  }

  if ((report.auditTier || "AUTOMATED_SCAN") === "AUTOMATED_SCAN") {
    if (report.manualReviewSigned) add("INTEGRITY-AUTO-MANUAL", "CRITICAL", "manualReviewSigned", "false", "true", "An automated scan cannot claim a completed manual review.", "Use MANUAL_AUDIT only after a persisted reviewer sign-off.")
    if ((report.claimedManualReviewHours || 0) > 0) add("INTEGRITY-AUTO-HOURS", "HIGH", "claimedManualReviewHours", "0", String(report.claimedManualReviewHours), "Automated scans must not report human review hours.", "Set manual review hours to zero.")
    if ((report.claimedAuditorCount || 0) > 0) add("INTEGRITY-AUTO-AUDITORS", "HIGH", "claimedAuditorCount", "0", String(report.claimedAuditorCount), "Automated scans must not invent auditor participation.", "Set auditor count to zero.")
  }
  if (report.claimedManualReviewHours && report.claimedEngineeringHours && report.claimedManualReviewHours > report.claimedEngineeringHours) {
    add("INTEGRITY-HOURS", "HIGH", "claimedManualReviewHours", `<= ${report.claimedEngineeringHours}`, String(report.claimedManualReviewHours), "Manual review hours exceed total engineering hours.", "Derive both values from the signed engagement record.")
  }
  if (report.secondReviewerSigned && !report.manualReviewSigned) add("INTEGRITY-SECOND-REVIEW", "HIGH", "secondReviewerSigned", "false until lead sign-off", "true", "A second reviewer cannot sign an unsigned engagement.", "Complete lead reviewer sign-off first.")
  if (report.reportLabel?.match(/AAA|EXCEPTIONAL|CERTIK/i) && !report.manualReviewSigned) add("INTEGRITY-BADGE", "CRITICAL", "reportLabel", "pending/manual label", report.reportLabel, "High-assurance labels require completed human review.", "Use PRELIMINARY or AUTOMATED SCAN.")
  if (report.reportVersion && !/^v\d+(\.\d+)?$/.test(report.reportVersion)) add("INTEGRITY-VERSION", "MEDIUM", "reportVersion", "vN or vN.N", report.reportVersion, "Report versions must be explicit and machine-checkable.", "Use v1, v1.1, etc.")
  if (report.claimedFuzzRuns && !(report.executedTools || []).some((tool) => /foundry|echidna|medusa|fuzz/i.test(tool))) add("INTEGRITY-FUZZ", "HIGH", "claimedFuzzRuns", "0 or an executed fuzzing tool", String(report.claimedFuzzRuns), "Fuzz run counts require a recorded tool execution.", "Attach the CI artifact and tool version.")
  if (report.productionReadiness && report.onChainRiskLabel && /production.?ready/i.test(report.productionReadiness) && /high|not recommended/i.test(report.onChainRiskLabel)) add("INTEGRITY-READINESS", "HIGH", "productionReadiness", "consistent with on-chain risk", report.productionReadiness, "Production readiness contradicts the declared on-chain risk.", "Resolve the risk or downgrade readiness.")
  return issues
}
