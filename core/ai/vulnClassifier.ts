// core/ai/vulnClassifier.ts
// AI-powered vulnerability classification engine

export interface Vulnerability {
  description: string
  location?: string
  code?: string
}

export interface ClassificationResult {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  category: VulnerabilityCategory
  confidence: number
  swcId?: string
  cweId?: string
  cvssScore?: number
  tags: string[]
}

export type VulnerabilityCategory =
  | "REENTRANCY"
  | "INTEGER_OVERFLOW"
  | "INTEGER_UNDERFLOW"
  | "ACCESS_CONTROL"
  | "UNCHECKED_RETURN"
  | "DELEGATECALL"
  | "SELFDESTRUCT"
  | "TIMESTAMP_DEPENDENCE"
  | "FRONT_RUNNING"
  | "DOS"
  | "ORACLE_MANIPULATION"
  | "FLASH_LOAN"
  | "SIGNATURE_REPLAY"
  | "STORAGE_COLLISION"
  | "UNINITIALIZED_STORAGE"
  | "WEAK_RANDOMNESS"
  | "CENTRALIZATION"
  | "GAS_GRIEFING"
  | "UNKNOWN"

// SWC Registry mapping
const SWC_MAP: Record<VulnerabilityCategory, string> = {
  REENTRANCY: "SWC-107",
  INTEGER_OVERFLOW: "SWC-101",
  INTEGER_UNDERFLOW: "SWC-101",
  ACCESS_CONTROL: "SWC-115",
  UNCHECKED_RETURN: "SWC-104",
  DELEGATECALL: "SWC-112",
  SELFDESTRUCT: "SWC-106",
  TIMESTAMP_DEPENDENCE: "SWC-116",
  FRONT_RUNNING: "SWC-114",
  DOS: "SWC-128",
  ORACLE_MANIPULATION: "N/A",
  FLASH_LOAN: "N/A",
  SIGNATURE_REPLAY: "SWC-121",
  STORAGE_COLLISION: "SWC-124",
  UNINITIALIZED_STORAGE: "SWC-109",
  WEAK_RANDOMNESS: "SWC-120",
  CENTRALIZATION: "N/A",
  GAS_GRIEFING: "SWC-126",
  UNKNOWN: "N/A",
}

// CWE mapping
const CWE_MAP: Record<VulnerabilityCategory, string> = {
  REENTRANCY: "CWE-841",
  INTEGER_OVERFLOW: "CWE-190",
  INTEGER_UNDERFLOW: "CWE-191",
  ACCESS_CONTROL: "CWE-284",
  UNCHECKED_RETURN: "CWE-252",
  DELEGATECALL: "CWE-829",
  SELFDESTRUCT: "CWE-284",
  TIMESTAMP_DEPENDENCE: "CWE-829",
  FRONT_RUNNING: "CWE-362",
  DOS: "CWE-400",
  ORACLE_MANIPULATION: "CWE-20",
  FLASH_LOAN: "CWE-20",
  SIGNATURE_REPLAY: "CWE-294",
  STORAGE_COLLISION: "CWE-119",
  UNINITIALIZED_STORAGE: "CWE-457",
  WEAK_RANDOMNESS: "CWE-330",
  CENTRALIZATION: "CWE-269",
  GAS_GRIEFING: "CWE-400",
  UNKNOWN: "N/A",
}

// CVSS base scores by category
const CVSS_MAP: Record<VulnerabilityCategory, number> = {
  REENTRANCY: 9.8,
  INTEGER_OVERFLOW: 7.5,
  INTEGER_UNDERFLOW: 7.5,
  ACCESS_CONTROL: 8.8,
  UNCHECKED_RETURN: 5.3,
  DELEGATECALL: 9.8,
  SELFDESTRUCT: 9.8,
  TIMESTAMP_DEPENDENCE: 4.3,
  FRONT_RUNNING: 5.9,
  DOS: 5.3,
  ORACLE_MANIPULATION: 9.1,
  FLASH_LOAN: 9.1,
  SIGNATURE_REPLAY: 7.5,
  STORAGE_COLLISION: 8.1,
  UNINITIALIZED_STORAGE: 7.5,
  WEAK_RANDOMNESS: 5.9,
  CENTRALIZATION: 6.5,
  GAS_GRIEFING: 4.3,
  UNKNOWN: 3.0,
}

// Keyword patterns for classification
const PATTERNS: Array<{ pattern: RegExp; category: VulnerabilityCategory; severity: ClassificationResult["severity"] }> = [
  // Critical
  { pattern: /reentran(cy|t)/i, category: "REENTRANCY", severity: "CRITICAL" },
  { pattern: /delegatecall.*untrusted/i, category: "DELEGATECALL", severity: "CRITICAL" },
  { pattern: /selfdestruct|suicide/i, category: "SELFDESTRUCT", severity: "CRITICAL" },
  { pattern: /flash\s*loan.*attack/i, category: "FLASH_LOAN", severity: "CRITICAL" },
  { pattern: /oracle.*manipulat/i, category: "ORACLE_MANIPULATION", severity: "CRITICAL" },

  // High
  { pattern: /overflow/i, category: "INTEGER_OVERFLOW", severity: "HIGH" },
  { pattern: /underflow/i, category: "INTEGER_UNDERFLOW", severity: "HIGH" },
  { pattern: /access\s*control|unauthorized|permission/i, category: "ACCESS_CONTROL", severity: "HIGH" },
  { pattern: /signature.*replay|replay.*attack/i, category: "SIGNATURE_REPLAY", severity: "HIGH" },
  { pattern: /storage.*collision/i, category: "STORAGE_COLLISION", severity: "HIGH" },
  { pattern: /uninitiali[zs]ed.*storage/i, category: "UNINITIALIZED_STORAGE", severity: "HIGH" },

  // Medium
  { pattern: /unchecked.*return|return.*not.*check/i, category: "UNCHECKED_RETURN", severity: "MEDIUM" },
  { pattern: /timestamp|block\.timestamp/i, category: "TIMESTAMP_DEPENDENCE", severity: "MEDIUM" },
  { pattern: /front.?run|sandwich|mev/i, category: "FRONT_RUNNING", severity: "MEDIUM" },
  { pattern: /denial.*service|dos|gas.*limit/i, category: "DOS", severity: "MEDIUM" },
  { pattern: /centrali[zs]/i, category: "CENTRALIZATION", severity: "MEDIUM" },

  // Low
  { pattern: /random|blockhash/i, category: "WEAK_RANDOMNESS", severity: "LOW" },
  { pattern: /gas.*grief/i, category: "GAS_GRIEFING", severity: "LOW" },
]

// Main classification function
export function classifyVulnerability(v: Vulnerability): ClassificationResult {
  const text = `${v.description} ${v.location || ""} ${v.code || ""}`.toLowerCase()

  // Find best matching pattern
  let bestMatch: { category: VulnerabilityCategory; severity: ClassificationResult["severity"]; confidence: number } = {
    category: "UNKNOWN",
    severity: "INFO",
    confidence: 0.5,
  }

  for (const { pattern, category, severity } of PATTERNS) {
    if (pattern.test(text)) {
      const confidence = calculateConfidence(text, pattern)
      if (confidence > bestMatch.confidence) {
        bestMatch = { category, severity, confidence }
      }
    }
  }

  // Generate tags
  const tags: string[] = []
  if (text.includes("erc20") || text.includes("token")) tags.push("token")
  if (text.includes("erc721") || text.includes("nft")) tags.push("nft")
  if (text.includes("defi") || text.includes("swap") || text.includes("liquidity")) tags.push("defi")
  if (text.includes("governance") || text.includes("vote")) tags.push("governance")
  if (text.includes("proxy") || text.includes("upgrade")) tags.push("upgradeable")
  if (text.includes("external") || text.includes("call")) tags.push("external-call")

  return {
    severity: bestMatch.severity,
    category: bestMatch.category,
    confidence: bestMatch.confidence,
    swcId: SWC_MAP[bestMatch.category],
    cweId: CWE_MAP[bestMatch.category],
    cvssScore: CVSS_MAP[bestMatch.category],
    tags,
  }
}

function calculateConfidence(text: string, pattern: RegExp): number {
  const matches = text.match(pattern)
  if (!matches) return 0

  // Base confidence
  let confidence = 0.7

  // Increase confidence for multiple matches
  const allMatches = text.match(new RegExp(pattern, "gi"))
  if (allMatches && allMatches.length > 1) {
    confidence += 0.1 * Math.min(allMatches.length - 1, 2)
  }

  // Increase confidence if code is provided
  if (text.includes("function") || text.includes("contract")) {
    confidence += 0.1
  }

  return Math.min(confidence, 0.99)
}

// Batch classification
export function classifyMultiple(vulnerabilities: Vulnerability[]): ClassificationResult[] {
  return vulnerabilities.map(classifyVulnerability)
}

// Get severity from CVSS score
export function severityFromCVSS(score: number): ClassificationResult["severity"] {
  if (score >= 9.0) return "CRITICAL"
  if (score >= 7.0) return "HIGH"
  if (score >= 4.0) return "MEDIUM"
  if (score >= 0.1) return "LOW"
  return "INFO"
}

// Generate human-readable report
export function generateClassificationReport(
  v: Vulnerability,
  result: ClassificationResult
): string {
  return `
## Vulnerability Classification

**Category:** ${result.category}
**Severity:** ${result.severity}
**Confidence:** ${(result.confidence * 100).toFixed(1)}%

### Standards Mapping
- **SWC ID:** ${result.swcId}
- **CWE ID:** ${result.cweId}
- **CVSS Score:** ${result.cvssScore}

### Tags
${result.tags.map((t) => `- ${t}`).join("\n")}

### Original Description
${v.description}

${v.location ? `**Location:** ${v.location}` : ""}
`.trim()
}
