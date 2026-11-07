import type { PortfolioProject } from "./solay39-constants"
import { preliminaryModel, reportText } from "./preliminary-report"
import { directoryLogo, normalizeDirectory } from "./skynet-directory"
import { technicalReviewModel } from "./technical-review"

/** Presentation of public declarations, never an approval/verification engine. */
export function projectProfileModel(project: PortfolioProject) {
  const preliminary = preliminaryModel(project)
  const technical = technicalReviewModel(project.technicalReview)
  const directory = normalizeDirectory([project])[0]
  const severities = [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "INFO",
    "UNCLASSIFIED",
  ] as const
  const findings = preliminary.findings.map((finding, index) => ({
    ...finding,
    displayId: `F-${String(index + 1).padStart(2, "0")}`,
    category: severities.includes(
      finding.severity as (typeof severities)[number]
    )
      ? finding.severity
      : "UNCLASSIFIED",
  }))
  return {
    ...preliminary,
    findings,
    findingsSupplied: Array.isArray(project.findings),
    distribution: severities.map((severity) => ({
      severity,
      count: findings.filter((f) => f.category === severity).length,
    })),
    name: reportText(project.name, 200) || "Unnamed project",
    ticker: reportText(project.ticker, 24),
    network: reportText(project.network, 60) || "Not disclosed",
    address: reportText(project.contractAddress, 160),
    description: reportText(project.description, 1000),
    logoUrl: directoryLogo(project.logoUrl) || undefined,
    declaredAt: directory?.reportedAt ?? null,
    technical,
    // Serialized ratings, signatures, resolved flags and approval statuses are
    // deliberately excluded. Linked metadata does not authenticate artifacts.
    score: null,
    status: "Preliminary" as const,
  }
}

/** Only existing public report content used by the shared report/profile views. */
export function publicProfileSnapshot(
  project: PortfolioProject
): PortfolioProject {
  const fields = [
    "id",
    "name",
    "ticker",
    "network",
    "contractAddress",
    "date",
    "createdAt",
    "created_at",
    "description",
    "logoUrl",
    "scope",
    "findings",
    "reportIntegrity",
    "ciAnalysis",
    "engagement",
    "codeMetrics",
    "scopeTable",
    "trustModel",
    "architectureOverview",
    "technicalReview",
    "contractUncertainty",
    "attackSurface",
    "exploitSimulation",
    "testingMethodology",
    "testCoverage",
  ]
  const result = Object.fromEntries(
    fields
      .filter((k) => Object.hasOwn(project, k))
      .map((k) => [k, (project as unknown as Record<string, unknown>)[k]])
  )
  // Do not mirror unrelated nested fields (including signatures/private reviews).
  const source = project.engagement
  result.engagement = source
    ? {
        repositoryUrl: source.repositoryUrl,
        commitHash: source.commitHash,
        compilerVersionUsed: source.compilerVersionUsed,
      }
    : undefined
  const integrity = project.reportIntegrity
  result.reportIntegrity = integrity
    ? {
        sourceSha256: integrity.sourceSha256,
      }
    : undefined
  const ci = project.ciAnalysis
  const tool = (value: unknown) => {
    if (!value || typeof value !== "object") return undefined
    const row = value as Record<string, unknown>
    return {
      success: row.success === true,
      version: reportText(row.version, 200),
      error: reportText(row.error, 6000),
    }
  }
  result.ciAnalysis = ci
    ? {
        jobId: ci.jobId,
        runUrl: ci.runUrl,
        result: ci.result
          ? {
              evidenceManifest: {
                source_sha256: ci.result.evidenceManifest?.source_sha256,
              },
              slither: tool(ci.result.slither),
              mythril: tool(ci.result.mythril),
            }
          : undefined,
      }
    : undefined
  return result as unknown as PortfolioProject
}
