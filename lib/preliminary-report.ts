import type { PortfolioProject, SeverityLevel } from "./solay39-constants"
import { technicalReviewMarkdown } from "./technical-review"
import { historicalExecutionMarkdown } from "./historical-execution"

export const REPORT_SEVERITIES: SeverityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
export const reportText = (value: unknown, limit = 12000): string =>
  typeof value === "string" ? value.slice(0, limit) : ""
export function safeReportUrl(value: unknown): string | undefined {
  try {
    const url = new URL(reportText(value, 2000))
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
export interface RecordIssue { id: string; title: string; detail: string }

/** Consistency checks inspect declarations, not the contract or deployed behavior. */
export function recordIssues(record: PortfolioProject): RecordIssue[] {
  const issues: RecordIssue[] = []
  const findings = (Array.isArray(record.findings) ? record.findings : []).filter(f => f && typeof f.title === "string")
  const fixedSupply = findings.some(f => /fixed supply|constructor.only mint/i.test(`${f.title} ${f.description}`))
  const mintClaim = (Array.isArray(record.contractUncertainty) && record.contractUncertainty.some(x => x && x.label === "Mint Function" && x.value === true)) ||
    (Array.isArray(record.attackSurface) && record.attackSurface.some(x => x && /unrestricted mint|mint.*without.*access control/i.test(`${x.title} ${x.description}`)))
  if (fixedSupply && mintClaim) issues.push({
    id: "supply-conflict", title: "Conflicting supply claims",
    detail: "One section declares constructor-only minting, while another declares a callable or unrestricted mint. Verify the implementation and reachable mint functions before drawing a conclusion.",
  })
  const proxyClaim = /proxy/i.test(reportText(record.codeMetrics?.upgradeabilityPattern)) &&
    !/no proxy|none|immutable/i.test(reportText(record.codeMetrics?.upgradeabilityPattern))
  if (proxyClaim && Array.isArray(record.exploitSimulation?.vectors) && record.exploitSimulation.vectors.some(v => v && /immutable|no proxy\/upgrade/i.test(reportText(v.description)))) {
    issues.push({ id: "proxy-conflict", title: "Conflicting upgradeability claims",
      detail: "The architecture declares a proxy, but a saved simulation describes an immutable contract. Resolve the proxy and implementation addresses and verify upgrade authority." })
  }
  if (record.testingMethodology?.fuzzingApplied === true && record.testCoverage?.fuzzTesting?.status === "NOT_RUN") {
    issues.push({ id: "test-conflict", title: "Conflicting test execution claims",
      detail: "The methodology claims fuzzing, but the execution record says NOT_RUN. Historical narrative logs cannot establish which tests actually ran." })
  }
  if ((Array.isArray(record.scopeTable) && record.scopeTable.some(x => x && /^0x[a-fA-F0-9]{40}$/.test(reportText(x.commit)))) ||
    /^0x[a-fA-F0-9]{40}$/.test(reportText(record.engagement?.commitHash))) {
    issues.push({ id: "commit-conflict", title: "Contract address used as a commit",
      detail: "An on-chain address identifies a deployment, not a source revision. Attach the actual repository commit or an immutable source snapshot." })
  }
  return issues
}
export function findingReviewQuestion(title: string): string {
  if (/mint/i.test(title)) return "Inspect the implemented mint function, not an interface or modifier name. Check entry guards such as if (msg.sender != minter) revert NotMinter(), inherited authorization and every overload. Distinguish authorized uncapped minting from a public bypass; reproduce unauthorized and authorized calls separately."
  if (/delegatecall/i.test(title)) return "Which reachable call path lets an unprivileged actor choose the target or implementation? Check target control, upgrade authorization and storage layout before confirming exploitability."
  if (/pragma/i.test(title)) return "Record the exact deployed compiler, optimizer settings and reproducible build. Determine whether the declared version range creates a concrete deployment risk."
  if (/fixed supply|constructor.only/i.test(title)) return "Confirm every reachable mint path, including inherited code and any proxy implementation. Reconcile this claim with the rest of the report."
  if (/concentration/i.test(title)) return "Verify the allocation with a dated on-chain snapshot. Keep distribution and governance observations separate from code vulnerabilities."
  return "Verify the exact source location, preconditions, reachable impact and remediation. Attach reproduction evidence before confirming this finding."
}
export function preliminaryModel(project: PortfolioProject, declaredRecord = project) {
  const findings = (Array.isArray(project.findings) ? project.findings : []).filter(f => f && typeof f.title === "string")
  const counts = Object.fromEntries(REPORT_SEVERITIES.map(s => [s, findings.filter(f => f.severity === s).length])) as Record<SeverityLevel, number>
  const declaredHash = reportText(project.reportIntegrity?.sourceSha256)
  const sourceHash = /^[a-f0-9]{64}$/i.test(declaredHash) ? declaredHash : undefined
  const ci = project.ciAnalysis
  const runUrl = /^[a-f0-9-]{36}$/.test(reportText(ci?.jobId)) &&
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(reportText(ci?.runUrl))
    ? ci?.runUrl : undefined
  const ciLinked = !!(runUrl && sourceHash && ci?.result?.evidenceManifest?.source_sha256 === sourceHash)
  const sourceUrl = safeReportUrl(project.engagement?.repositoryUrl)
  const issues = recordIssues(declaredRecord)
  const pocCount = findings.filter(f => f.foundryPoC || f.proofOfConcept).length
  const scope = Array.isArray(project.scopeTable) ? project.scopeTable.filter(x => x && typeof x.contract === "string") : []
  const trust = Array.isArray(project.trustModel) ? project.trustModel.filter(x => x && typeof x.component === "string") : []
  return { findings, counts, sourceHash, sourceUrl, ci, ciLinked, runUrl, issues, pocCount, scope, trust }
}
/** Export is a technical draft, never a certificate or a replayed tool log. */
export function preliminaryMarkdown(project: PortfolioProject, declaredRecord = project, declarationIssues?: RecordIssue[]): string {
  const model = preliminaryModel(project, declaredRecord)
  const m = { ...model, issues: declarationIssues ?? model.issues }
  const sections = [
    `# ${reportText(project.name, 200)}: preliminary technical report`,
    "Status: awaiting founder review. Findings and severities are submitted, not validated. No verified security score or deployment recommendation is issued.",
    `This draft reproduces submitted material from the [canonical report record](https://www.solay39.eu/api/audits?id=${encodeURIComponent(project.id)}); that record is not independent execution evidence.`,
    `## Scope\n\nReport ID: ${project.id}\n\nNetwork: ${project.network}\n\nContract: ${project.contractAddress || "Not supplied"}\n\nSource SHA-256 (declared): ${m.sourceHash || "Not supplied"}`,
    m.sourceUrl ? `Declared source: [source location supplied in the record](${m.sourceUrl}). Source and deployment correspondence are not validated here.` : "",
    project.architectureOverview ? `## Submitted architecture\n\n${reportText(project.architectureOverview)}` : "",
    m.scope.length ? `## Submitted source inventory\n\n${m.scope.map(s => `- ${s.contract}: ${reportText(s.language)}, declared LOC ${Number.isFinite(s.linesOfCode) ? s.linesOfCode : "not supplied"}; source revision ${/^[a-f0-9]{7,40}$/i.test(reportText(s.commit)) ? s.commit : "not established"}.`).join("\n")}` : "",
    m.trust.length ? `## Declared trust boundaries\n\n${m.trust.map(t => `- ${t.component}: ${reportText(t.trustRequired)} trust declared. ${reportText(t.riskIfCompromised)} Proposed control: ${reportText(t.mitigation) || "not supplied"}`).join("\n")}` : "",
    technicalReviewMarkdown(project.technicalReview),
    historicalExecutionMarkdown(project),
    `## Record consistency\n\n${m.issues.length ? m.issues.map(x => `- ${x.title}: ${x.detail}`).join("\n") : "No supported consistency rule detected a conflict. This does not validate the report."}`,
    `## Evidence status\n\nSource-bound CI: ${m.ciLinked ? "Linked to declared digest; founder review pending" : "Not established"}\n\nFounder approval: pending\n\nReproduction: submitted code is not proof of successful execution.`,
    ...m.findings.map((f, i) => {
      const code = (label: string, value?: string | null) => value ? `\n\n${label} (submitted, not executed or validated):\n\n${reportText(value, 50000).split("\n").map(line => `    ${line}`).join("\n")}` : ""
      return `## F-${String(i + 1).padStart(2, "0")}: ${f.title}\n\nSubmitted severity: ${f.severity}\n\nLocation: ${f.location || "Not supplied"}\n\n${f.description || ""}\n\nDeclared impact: ${f.impact || "Not supplied"}\n\nProposed remediation: ${f.recommendation || "Not supplied"}\n\n${f.cvss ? `Declared CVSS (not validated): ${f.cvss.baseScore}; ${reportText(f.cvss.vectorString)}\n\n` : ""}Review question: ${findingReviewQuestion(f.title)}${code("Remediation example", f.remediationExample)}${code("PoC code", f.foundryPoC || f.proofOfConcept)}`
    }),
    "## Approval\n\nOnly the founder may approve this report. Unsupported ratings, staffing metrics, synthetic logs and simulation execution claims are intentionally excluded.",
  ]
  return sections.filter(Boolean).join("\n\n")
}
