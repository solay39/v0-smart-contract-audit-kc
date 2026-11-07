// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Enterprise Audit Pipeline Orchestrator
// /core/pipeline/enterprisePipeline.ts
//
// 10-step enterprise pipeline:
//  1. Static Scan
//  2. Manual Review
//  3. Assign CVSS + CWE + SWC
//  4. Generate Exploit PoC
//  5. Run Foundry Test
//  6. Generate JSON
//  7. Founder Approval Required (not performed here)
//  8. Validate Founder Review (not performed here)
//  9. Publish On-Chain
// 10. Export Signed PDF
// ═══════════════════════════════════════════════════════════════

import { computeCVSS } from "../severity/cvssEngine"
import { classifyFromTitle } from "../severity/classificationEngine"
import { generateExploitForFinding } from "../poc/exploitGenerator"
import { simulateExploitTest, type ExploitTestResult } from "../poc/foundryRunner"
import { type AuditorSignature } from "../review/dualReviewGate"

// ─── Types ──────────────────────────────────────────────────────

export interface PipelineFinding {
  id: string
  title: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  contractName: string
  contractAddress?: string
  vulnerableFunction?: string
  status: "OPEN" | "RESOLVED" | "ACKNOWLEDGED"
}

export interface PipelineResult {
  step: string
  status: "pass" | "fail" | "skip" | "warn"
  details: string
  data?: unknown
}

export interface EnrichedFinding extends PipelineFinding {
  cvss: {
    score: number
    severity: string
    vector: string
  }
  classification: {
    cwe: string
    swc: string
  }
  poc: {
    generated: boolean
    code: string
    file: string
    exploitType: string
  }
  exploitResult: ExploitTestResult
}

export interface PipelineOutput {
  projectName: string
  findings: EnrichedFinding[]
  pipelineSteps: PipelineResult[]
  dualReview: {
    valid: boolean
    uniqueAuditors: number
    errors: string[]
  }
  signatures: AuditorSignature[]
  timestamp: string
}

// ─── Pipeline Execution ─────────────────────────────────────────

/**
 * Prepare candidate findings and templates. This function has no tool execution,
 * manual-review evidence or cryptographic approval authority.
 */
export function runEnterprisePipeline(
  projectName: string,
  findings: PipelineFinding[],
  signatures: AuditorSignature[] = [],
): PipelineOutput {
  const steps: PipelineResult[] = []

  // ── Step 1: Static Scan (pre-completed) ──
  steps.push({
    step: "1. Static Scan",
    status: "warn",
    details: `${findings.length} submitted findings. Tool provenance is not supplied to this function.`,
  })

  // ── Step 2: Manual Review (pre-completed) ──
  steps.push({
    step: "2. Manual Review",
    status: "skip",
    details: "Founder review is pending. Submitted findings do not prove manual review.",
  })

  // ── Step 3: Assign CVSS + CWE + SWC ──
  const enrichedFindings: EnrichedFinding[] = findings.map((f) => {
    // Map severity string to CVSS vector defaults
    const vectorMap: Record<string, Parameters<typeof computeCVSS>[0]> = {
      CRITICAL: { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "H", I: "H", A: "H" },
      HIGH:     { AV: "N", AC: "L", PR: "L", UI: "N", S: "U", C: "H", I: "H", A: "N" },
      MEDIUM:   { AV: "N", AC: "H", PR: "L", UI: "N", S: "U", C: "L", I: "L", A: "N" },
      LOW:      { AV: "L", AC: "H", PR: "H", UI: "R", S: "U", C: "N", I: "L", A: "N" },
      INFO:     { AV: "N", AC: "H", PR: "H", UI: "R", S: "U", C: "N", I: "N", A: "N" },
    }

    const cvssResult = computeCVSS(vectorMap[f.severity] || vectorMap.MEDIUM)
    const classification = classifyFromTitle(f.title)

    // ── Step 4: Generate Exploit PoC ──
    const poc = generateExploitForFinding(f.title, {
      contractName: f.contractName,
      vulnerableFunction: f.vulnerableFunction || "vulnerableFunction",
      contractAddress: f.contractAddress,
      findingId: f.id,
    })

    // ── Step 5: Run Foundry Test ──
    const exploitResult = simulateExploitTest(f.id, f.severity)

    return {
      ...f,
      cvss: cvssResult,
      classification,
      poc: {
        generated: true,
        code: poc.pocCode,
        file: poc.pocFile,
        exploitType: poc.exploitType,
      },
      exploitResult,
    }
  })

  steps.push({
    step: "3. Assign CVSS + CWE + SWC",
    status: "warn",
    details: `${enrichedFindings.length} provisional severity-based CVSS vectors and title-based classifications; founder validation required`,
    data: enrichedFindings.map((f) => ({
      id: f.id,
      cvss: f.cvss.score,
      vector: f.cvss.vector,
      cwe: f.classification.cwe,
      swc: f.classification.swc,
    })),
  })

  // ── Step 4: Generate Exploit PoC ──
  const pocsGenerated = enrichedFindings.filter((f) => f.poc.generated).length
  steps.push({
    step: "4. Generate Exploit PoC",
    status: pocsGenerated > 0 ? "pass" : "skip",
    details: `${pocsGenerated}/${enrichedFindings.length} uncompiled PoC templates generated; none executed or validated`,
  })

  // ── Step 5: Run Foundry Test ──
  const exploitResults = enrichedFindings.map((f) => f.exploitResult)
  steps.push({
    step: "5. Run Foundry Test",
    status: "skip",
    details: "NOT RUN. No exploit execution, blocked exploit or contract safety is established.",
    data: exploitResults,
  })

  // ── Step 6: Generate JSON ──
  steps.push({
    step: "6. Generate JSON",
    status: "pass",
    details: `Structured finding JSON with CVSS, CWE, SWC, PoC, and exploit results`,
  })

  // ── Step 7: Dual Signatures Required ──
  steps.push({
    step: "7. Founder Approval Required",
    status: "warn",
    details: "Only the founder can approve. Submitted signature strings are not verified approval.",
  })

  // ── Step 8: Validate Dual Review ──
  // Retain the legacy output field without accepting signature counts as proof.
  const reviewResult = {
    valid: false,
    uniqueAuditors: new Set(signatures.map(s => s.auditor.toLowerCase())).size,
    errors: ["Server-verified founder approval bound to the exact source and report is required."],
  }
  steps.push({
    step: "8. Validate Founder Review",
    status: "skip",
    details: reviewResult.errors.join("; "),
    data: reviewResult,
  })

  // ── Step 9: Publish On-Chain (handled by caller via /api/registry) ──
  steps.push({
    step: "9. Publish On-Chain",
    status: "skip",
    details: "Not published. Separate verified founder approval is required.",
  })

  // ── Step 10: Export Signed PDF (handled by caller via export-pdf) ──
  steps.push({
    step: "10. Export Signed PDF",
    status: "skip",
    details: "Not signed. Export must preserve preliminary status until verified founder approval.",
  })

  return {
    projectName,
    findings: enrichedFindings,
    pipelineSteps: steps,
    dualReview: reviewResult,
    signatures,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Generate a standardized finding JSON output (per the user's spec).
 */
export function generateFindingJSON(finding: EnrichedFinding): object {
  return {
    assessment_status: "UNVALIDATED_CANDIDATE",
    cvss_status: "PROVISIONAL",
    finding_id: finding.id,
    title: finding.title,
    severity: finding.severity,
    cvss_score: finding.cvss.score,
    vector: finding.cvss.vector,
    cwe: finding.classification.cwe,
    swc: finding.classification.swc,
    poc_generated: finding.poc.generated,
    exploit_result: finding.exploitResult.exploit_result,
    execution_status: finding.exploitResult.execution_status,
    tests_executed: finding.exploitResult.tests_executed,
    poc_file: finding.poc.file,
    status: finding.status,
  }
}
