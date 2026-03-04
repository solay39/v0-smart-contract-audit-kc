// ═══════════════════════════════════════════════════════════════
// SOLAY39 — CVSS v3.1 Engine (Standalone)
// /core/severity/cvssEngine.ts
// Spec-compliant CVSS calculator with all metric weights
// ═══════════════════════════════════════════════════════════════

export interface CVSSVector {
  AV: "N" | "A" | "L" | "P"  // Attack Vector
  AC: "L" | "H"               // Attack Complexity
  PR: "N" | "L" | "H"         // Privileges Required
  UI: "N" | "R"               // User Interaction
  S: "U" | "C"                // Scope
  C: "H" | "L" | "N"          // Confidentiality
  I: "H" | "L" | "N"          // Integrity
  A: "H" | "L" | "N"          // Availability
}

export interface CVSSResult {
  score: number
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE"
  vector: string
}

const weights = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 } as Record<string, number>,
  AC: { L: 0.77, H: 0.44 } as Record<string, number>,
  PR: {
    N: { U: 0.85, C: 0.85 },
    L: { U: 0.62, C: 0.68 },
    H: { U: 0.27, C: 0.5 },
  } as Record<string, Record<string, number>>,
  UI: { N: 0.85, R: 0.62 } as Record<string, number>,
  S: { U: 6.42, C: 7.52 } as Record<string, number>,
  CIA: { N: 0, L: 0.22, H: 0.56 } as Record<string, number>,
}

/**
 * Compute CVSS v3.1 base score from a vector.
 * Uses official NIST spec weights and rounding rules.
 */
export function computeCVSS(v: CVSSVector): CVSSResult {
  const iss = 1 - (1 - weights.CIA[v.C]) * (1 - weights.CIA[v.I]) * (1 - weights.CIA[v.A])

  const impact = v.S === "U"
    ? weights.S.U * iss
    : weights.S.C * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)

  const exploitability =
    8.22 * weights.AV[v.AV] * weights.AC[v.AC] * weights.PR[v.PR][v.S] * weights.UI[v.UI]

  if (impact <= 0) {
    return { score: 0, severity: "NONE", vector: vectorString(v) }
  }

  const raw = v.S === "U"
    ? Math.min(impact + exploitability, 10)
    : Math.min(1.08 * (impact + exploitability), 10)

  // CVSS spec: round up to nearest 0.1
  const score = Math.ceil(raw * 10) / 10

  return {
    score,
    severity: severityFromScore(score),
    vector: vectorString(v),
  }
}

function severityFromScore(score: number): CVSSResult["severity"] {
  if (score >= 9.0) return "CRITICAL"
  if (score >= 7.0) return "HIGH"
  if (score >= 4.0) return "MEDIUM"
  if (score > 0.0) return "LOW"
  return "NONE"
}

function vectorString(v: CVSSVector): string {
  return `CVSS:3.1/AV:${v.AV}/AC:${v.AC}/PR:${v.PR}/UI:${v.UI}/S:${v.S}/C:${v.C}/I:${v.I}/A:${v.A}`
}

/**
 * Parse a CVSS v3.1 vector string back into components.
 */
export function parseCVSSVector(vs: string): CVSSVector | null {
  const parts = vs.replace("CVSS:3.1/", "").split("/")
  const map: Record<string, string> = {}
  for (const part of parts) {
    const [key, val] = part.split(":")
    if (key && val) map[key] = val
  }

  if (!map.AV || !map.AC || !map.PR || !map.UI || !map.S || !map.C || !map.I || !map.A) {
    return null
  }

  return map as unknown as CVSSVector
}
