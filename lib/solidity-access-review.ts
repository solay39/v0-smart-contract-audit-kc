/**
 * Conservative lexical observations, NOT a compiler AST or an authorization proof.
 * Comments/strings cannot supply guards. Only a recognized entry check in the
 * same implemented function is observed; inheritance and custom logic need review.
 */
export type AccessObservation = "ENTRY_GUARD_OBSERVED" | "NO_ENTRY_GUARD_OBSERVED" | "REVIEW_REQUIRED"
export interface SourceFunction {
  name: string
  signature: string
  line: number
  endLine: number
  start: number
  end: number
  visibility: string
  body: string
  maskedBody: string
  header: string
  parameters: string
}

export function maskSolidity(code: string): string {
  return code.replace(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    token => token.replace(/[^\r\n]/g, " "))
}

function closing(text: string, start: number, left: string, right: string): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === left) depth++
    else if (text[i] === right && --depth === 0) return i
  }
  return -1
}

export function sourceFunctions(code: string): SourceFunction[] {
  const masked = maskSolidity(code)
  const pattern = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g
  const functions: SourceFunction[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(masked))) {
    const parameterStart = masked.indexOf("(", match.index)
    const parameterEnd = closing(masked, parameterStart, "(", ")")
    if (parameterEnd < 0) continue
    const tail = masked.slice(parameterEnd + 1).search(/[;{]/)
    if (tail < 0) continue
    const bodyStart = parameterEnd + 1 + tail
    if (masked[bodyStart] === ";") { pattern.lastIndex = bodyStart + 1; continue }
    const end = closing(masked, bodyStart, "{", "}")
    if (end < 0) continue
    const header = masked.slice(parameterEnd + 1, bodyStart)
    functions.push({
      name: match[1], signature: code.slice(match.index, bodyStart).trim(),
      line: masked.slice(0, match.index).split("\n").length,
      endLine: masked.slice(0, end).split("\n").length,
      start: match.index, end: end + 1,
      visibility: header.match(/\b(public|external|internal|private)\b/)?.[1] || "unspecified",
      body: code.slice(bodyStart + 1, end), maskedBody: masked.slice(bodyStart + 1, end),
      header, parameters: masked.slice(parameterStart + 1, parameterEnd),
    })
    pattern.lastIndex = end + 1
  }
  return functions
}

/** Recognize only a narrow, unconditional entry check against a non-parameter authority. */
export function observeEntryGuard(fn: SourceFunction): { status: AccessObservation; evidence: string | null } {
  const sender = String.raw`(?:msg\s*\.\s*sender|_msgSender\s*\(\s*\))`
  const authority = String.raw`([A-Za-z_$][\w$]*(?:\s*\(\s*\))?)`
  const equal = new RegExp(String.raw`^\s*(?:${sender}\s*==\s*${authority}|${authority}\s*==\s*${sender})\s*$`)
  const unequal = new RegExp(String.raw`^\s*(?:${sender}\s*!=\s*${authority}|${authority}\s*!=\s*${sender})\s*$`)
  const parameterNames = fn.parameters.split(",").map(p => p.trim().split(/\s+/).at(-1))
  const trustedComparison = (condition: string, regex: RegExp) => {
    const match = condition.match(regex)
    const value = (match?.[1] || match?.[2] || "").replace(/\s+/g, "")
    return !!value && !parameterNames.includes(value) &&
      !["true", "false", "msg", "this", "tx", "_msgSender()"].includes(value)
  }
  const body = fn.maskedBody
  const requireMatch = body.match(/^\s*require\s*\(/)
  if (requireMatch) {
    const open = body.indexOf("(")
    const end = closing(body, open, "(", ")")
    const condition = body.slice(open + 1, end).split(",")[0]
    if (end >= 0 && trustedComparison(condition, equal)) {
      return { status: "ENTRY_GUARD_OBSERVED", evidence: fn.body.slice(0, end + 1).trim() }
    }
  }
  const ifMatch = body.match(/^\s*if\s*\(/)
  if (ifMatch) {
    const open = body.indexOf("(")
    const end = closing(body, open, "(", ")")
    const condition = body.slice(open + 1, end)
    const consequent = body.slice(end + 1)
    const reverting = /^\s*(?:revert\s+[A-Za-z_$][\w$]*\s*\([^;]*\)\s*;|{\s*revert\s+[A-Za-z_$][\w$]*\s*\([^;]*\)\s*;\s*})/.test(consequent)
    if (end >= 0 && reverting && trustedComparison(condition, unequal)) {
      return { status: "ENTRY_GUARD_OBSERVED", evidence: fn.body.slice(0, end + 1).trim() + " [revert branch]" }
    }
  }
  // A modifier name, a nested/later guard or an arbitrary helper isn't a proof.
  const headerWithoutKeywords = fn.header.replace(/\b(?:public|external|internal|private|view|pure|payable|virtual|override)\b/g, "")
    .replace(/\breturns\s*\([^)]*\)/g, "").trim()
  if (headerWithoutKeywords || /\b(?:if|require|assert|assembly|revert)\b|_checkRole\s*\(/.test(body)) {
    return { status: "REVIEW_REQUIRED", evidence: null }
  }
  return { status: "NO_ENTRY_GUARD_OBSERVED", evidence: null }
}

export function reviewMintAccess(code: string) {
  const functions = sourceFunctions(code).filter(fn => /^_?mint$/i.test(fn.name) && /^(public|external)$/.test(fn.visibility))
  const observations = functions.map(fn => ({ ...fn, ...observeEntryGuard(fn) }))
  const allGuarded = observations.length > 0 && observations.every(fn => fn.status === "ENTRY_GUARD_OBSERVED")
  const unresolved = observations.some(fn => fn.status === "REVIEW_REQUIRED")
  return {
    hasMint: functions.length > 0,
    isProtected: allGuarded,
    protectionType: allGuarded ? "observed function-local entry guard (not an execution proof)" : null,
    severity: !functions.length ? "NONE" as const : allGuarded || unresolved ? "MEDIUM" as const : "CRITICAL" as const,
    assessment: !functions.length ? "NO_CALLABLE_MINT" : allGuarded ? "GUARD_OBSERVED" : unresolved ? "REVIEW_REQUIRED" : "NO_GUARD_OBSERVED",
    observations,
  }
}

/** Reconcile a source-pattern contradiction, without promoting a finding to safe. */
export function reconcileMintFinding<T extends Record<string, unknown>>(finding: T, code: string): T {
  const title = String(finding.title || "")
  if (!/mint/i.test(title) || !/unrestricted|unprotected|unguarded|anyone|missing.*access|entry guard observed|authorization requires review/i.test(title)) return finding
  const review = reviewMintAccess(code)
  if (!review.isProtected && review.assessment !== "REVIEW_REQUIRED") return finding
  return {
    ...finding,
    title: review.isProtected ? "Mint Entry Guard Observed: Supply Policy Requires Review" : "Mint Authorization Requires Review",
    severity: "INFO",
    location: review.observations.map(fn => `${fn.name}: source line ${fn.line}`).join("; ") || "Mint authorization",
    description: review.isProtected
      ? "A recognized function-local entry guard is present in the submitted source. An unrestricted-mint conclusion is contradicted by that observation. Inherited paths, authority implementation and deployment correspondence remain unverified."
      : "Custom or inherited authorization is unresolved. The limited source analysis establishes neither an access-control bypass nor complete protection.",
    impact: "Public exploitability has not been demonstrated. Authorized supply expansion and minter delegation must be evaluated against the protocol's intended emission policy.",
    recommendation: "Test unauthorized and authorized callers separately on the exact source; inspect setMinter/role delegation, zero-address behavior, events and any external minter policy.",
    cvss: undefined, cwe: undefined, swc: undefined, foundryPoC: undefined,
    proofOfConcept: undefined, remediationExample: undefined,
  }
}
