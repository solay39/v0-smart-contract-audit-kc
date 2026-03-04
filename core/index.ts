// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Enterprise Core Modules
// Barrel export for all core audit infrastructure
// ═══════════════════════════════════════════════════════════════

// PoC Engine
export {
  generateAccessControlExploit,
  generateReentrancyExploit,
  generateUnrestrictedMintExploit,
  generateDoSExploit,
  generateGenericExploit,
  generateExploitForFinding,
} from "./poc/exploitGenerator"

export {
  runExploitTest,
  simulateExploitTest,
} from "./poc/foundryRunner"

// CVSS Engine
export {
  computeCVSS as computeCVSSFromVector,
  parseCVSSVector,
} from "./severity/cvssEngine"

// Classification Engine (CWE + SWC)
export {
  classify,
  classifyFromTitle,
  getSupportedTypes,
} from "./severity/classificationEngine"

// Dual Review Gate
export {
  enforceDualReview,
  validateDualReview as validateDualReviewGate,
  meetsMinimumReview,
} from "./review/dualReviewGate"

// Digital Signing
export {
  signReport as signReportCore,
  signPDF,
  sha256Hex,
} from "./signing/signReport"

export {
  verifySignature,
  verifyAllSignatures,
} from "./signing/verifySignature"

// Pipeline Orchestrator
export {
  runEnterprisePipeline,
  generateFindingJSON,
} from "./pipeline/enterprisePipeline"

// Types
export type { ExploitParams } from "./poc/exploitGenerator"
export type { ExploitTestResult } from "./poc/foundryRunner"
export type { CVSSVector, CVSSResult } from "./severity/cvssEngine"
export type { Classification } from "./severity/classificationEngine"
export type { AuditorSignature, DualReviewResult } from "./review/dualReviewGate"
export type { ReportSignature } from "./signing/signReport"
export type { VerificationResult } from "./signing/verifySignature"
export type {
  PipelineFinding,
  PipelineResult,
  EnrichedFinding,
  PipelineOutput,
} from "./pipeline/enterprisePipeline"
