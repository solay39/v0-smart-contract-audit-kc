// Function-level structural analysis for Solidity. Unlike regex signatures,
// this reads each function body in order, so it can tell whether an external
// call happens before or after a state write (checks-effects-interactions).

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export interface StructuralFinding {
  id: string
  name: string
  category: string
  severity: Severity
  confidence: number
  functionName: string
  line: number
  swc: string
  cwe: string
  description: string
  remediation: string
}

interface ParsedFunction {
  name: string
  header: string
  body: string
  bodyStart: number
}

const EXTERNAL_CALL = /\.call\s*[{(]|\.delegatecall\s*\(|\.transfer\s*\(|\.send\s*\(|\.safeTransfer(From)?\s*\(/
const PRIVILEGED_NAME = /^(set|update|change|transfer)(Owner|Admin|Governance|Operator|Treasury|Fee|Oracle|Minter|Implementation)|^(mint|pause|unpause|withdrawAll|emergencyWithdraw|upgradeTo|initialize|kill|destroy)$/i
const ACCESS_GUARD = /\bonly[A-Z]\w*|\bwhenNotPaused\b|require\s*\(\s*(msg\.sender|_msgSender\(\))\s*==|hasRole\s*\(|_checkOwner\s*\(|_checkRole\s*\(|if\s*\(\s*(msg\.sender|_msgSender\(\))\s*!=|\binitializer\b|\breinitializer\b/
const REENTRANCY_GUARD = /\bnonReentrant\b|\bnoReentrancy\b|\block\b/

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length))
}

function parseFunctions(code: string): ParsedFunction[] {
  const fns: ParsedFunction[] = []
  const re = /function\s+(\w+)\s*\(([^)]*)\)([^{;]*)\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const bodyStart = re.lastIndex
    let depth = 1
    let i = bodyStart
    while (i < code.length && depth > 0) {
      if (code[i] === "{") depth++
      else if (code[i] === "}") depth--
      i++
    }
    fns.push({ name: m[1], header: m[3], body: code.slice(bodyStart, i - 1), bodyStart })
    re.lastIndex = i
  }
  return fns
}

function stateVariables(code: string): Set<string> {
  const vars = new Set<string>()
  const contractBodies = code.split(/\bcontract\s+\w+[^{]*\{/).slice(1)
  for (const body of contractBodies) {
    let depth = 0
    let topLevel = ""
    for (const ch of body) {
      if (ch === "{") depth++
      else if (ch === "}") { if (depth === 0) break; depth-- }
      else if (depth === 0) topLevel += ch
    }
    const decl = /(?:mapping\s*\([^;]*\)|\b(?:uint\d*|int\d*|address|bool|bytes\d*|string)\b(?:\s+payable)?)\s+(?:public\s+|private\s+|internal\s+|immutable\s+|constant\s+)*(\w+)\s*[;=]/g
    let d: RegExpExecArray | null
    while ((d = decl.exec(topLevel)) !== null) vars.add(d[1])
  }
  return vars
}

function lineAt(code: string, index: number): number {
  return code.slice(0, index).split("\n").length
}

export function analyzeStructure(source: string): StructuralFinding[] {
  const code = stripComments(source)
  if (!/\bfunction\b/.test(code) || !/pragma\s+solidity|contract\s+\w+/.test(code)) return []

  const findings: StructuralFinding[] = []
  const stateVars = stateVariables(code)
  const isPublic = (h: string) => /\b(public|external)\b/.test(h) && !/\b(view|pure)\b/.test(h)

  for (const fn of parseFunctions(code)) {
    const line = lineAt(code, fn.bodyStart)

    const callMatch = EXTERNAL_CALL.exec(fn.body)
    if (callMatch && isPublic(fn.header) && !REENTRANCY_GUARD.test(fn.header)) {
      const afterCall = fn.body.slice(callMatch.index + callMatch[0].length)
      const writtenAfter = [...stateVars].find((v) =>
        new RegExp(`\\b${v}\\b(\\s*\\[[^\\]]*\\])*\\s*(=(?!=)|\\+=|-=|\\*=|/=|\\+\\+|--)`).test(afterCall),
      )
      if (writtenAfter) {
        findings.push({
          id: "STRUCT-REENT-001",
          name: "Reentrancy: state written after external call",
          category: "REENTRANCY",
          severity: /\.call\s*[{(]/.test(callMatch[0]) ? "CRITICAL" : "HIGH",
          confidence: 90,
          functionName: fn.name,
          line,
          swc: "SWC-107",
          cwe: "CWE-841",
          description: `${fn.name}() performs an external call and then updates state variable "${writtenAfter}". A malicious receiver can re-enter before the update (The DAO pattern).`,
          remediation: `Update "${writtenAfter}" before the external call (checks-effects-interactions) and add a nonReentrant modifier.`,
        })
      }
    }

    if (isPublic(fn.header) && PRIVILEGED_NAME.test(fn.name) && !ACCESS_GUARD.test(fn.header) && !ACCESS_GUARD.test(fn.body)) {
      findings.push({
        id: "STRUCT-AC-001",
        name: `Unprotected privileged function ${fn.name}()`,
        category: "ACCESS_CONTROL",
        severity: /owner|admin|implementation|upgrade|mint|initialize|destroy|kill/i.test(fn.name) ? "CRITICAL" : "HIGH",
        confidence: 85,
        functionName: fn.name,
        line,
        swc: "SWC-105",
        cwe: "CWE-284",
        description: `${fn.name}() is public/external, changes privileged state and has no access-control modifier or msg.sender check.`,
        remediation: "Restrict with onlyOwner / AccessControl roles, or make the function internal.",
      })
    }

    if (/\btx\.origin\b/.test(fn.body) && /require|if\s*\(/.test(fn.body)) {
      findings.push({
        id: "STRUCT-AUTH-002",
        name: "Authorization via tx.origin",
        category: "ACCESS_CONTROL",
        severity: "HIGH",
        confidence: 88,
        functionName: fn.name,
        line,
        swc: "SWC-115",
        cwe: "CWE-477",
        description: `${fn.name}() uses tx.origin for authorization; a phishing contract can act on behalf of the user.`,
        remediation: "Use msg.sender for authorization.",
      })
    }

    if (/\b(selfdestruct|suicide)\s*\(/.test(fn.body) && isPublic(fn.header) && !ACCESS_GUARD.test(fn.header) && !ACCESS_GUARD.test(fn.body)) {
      findings.push({
        id: "STRUCT-SD-001",
        name: "Unprotected selfdestruct",
        category: "ACCESS_CONTROL",
        severity: "CRITICAL",
        confidence: 92,
        functionName: fn.name,
        line,
        swc: "SWC-106",
        cwe: "CWE-284",
        description: `${fn.name}() can destroy the contract and is callable by anyone.`,
        remediation: "Remove selfdestruct or restrict it behind multisig + timelock.",
      })
    }

    if (/keccak256\s*\([^;]*\b(block\.(timestamp|difficulty|prevrandao|number)|blockhash)\b/.test(fn.body)) {
      findings.push({
        id: "STRUCT-RAND-001",
        name: "Weak on-chain randomness",
        category: "LOGIC_ERROR",
        severity: "MEDIUM",
        confidence: 80,
        functionName: fn.name,
        line,
        swc: "SWC-120",
        cwe: "CWE-330",
        description: `${fn.name}() derives randomness from block data, which validators and searchers can predict or influence.`,
        remediation: "Use Chainlink VRF or a commit-reveal scheme.",
      })
    }

    if (/\.call\s*[{(]/.test(fn.body) && !/\(\s*bool\s+\w+\s*,?[^)]*\)\s*=\s*[^;]*\.call/.test(fn.body) && !/require\s*\([^;]*\.call/.test(fn.body)) {
      findings.push({
        id: "STRUCT-UNCHK-001",
        name: "Unchecked low-level call return value",
        category: "UNCHECKED_RETURN",
        severity: "MEDIUM",
        confidence: 75,
        functionName: fn.name,
        line,
        swc: "SWC-104",
        cwe: "CWE-252",
        description: `${fn.name}() makes a low-level call without checking whether it succeeded.`,
        remediation: "Capture the bool result and require(success).",
      })
    }
  }

  return findings
}
