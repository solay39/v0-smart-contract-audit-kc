import type { CiAnalysisResult } from "./github-analysis-runner"
import type { Finding, SeverityLevel } from "./solay39-constants"

const severity = (raw: string): SeverityLevel => {
  const value = raw.toUpperCase()
  return ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(value) ? value as SeverityLevel : "INFO"
}

export function ciFindingsForWorkspace(result: CiAnalysisResult): Omit<Finding, "id" | "status" | "category">[] {
  return [
    ...result.slither.findings.map(f => ({
      title: `Slither: ${f.check}`, severity: severity(f.impact),
      location: f.elements.map(e => `${e.filename}:${e.lines.join(",")}`).join("; "),
      description: f.description, impact: `${f.impact}; confidence ${f.confidence}`,
      recommendation: "Validate this automated finding and its remediation during founder review.",
    })),
    ...result.mythril.findings.map(f => ({
      title: `Mythril: ${f.swc_id} ${f.swc_title}`, severity: severity(f.severity),
      location: `${f.contract}:${f.function}:${f.lineno}`, description: f.description,
      impact: f.severity, recommendation: "Reproduce this symbolic-execution finding before approval.",
    })),
  ]
}
