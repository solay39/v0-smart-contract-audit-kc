// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Audit Validator
// ═══════════════════════════════════════════════════════════════════

export type ValidationSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  field: string
  expected: string
  found: string
  detail: string
  fix: string
  autoFixable: boolean
  autoFixValue?: unknown
}

export interface ValidationResult {
  issues: ValidationIssue[]
  autoFixes: Record<string, unknown>
  score: number
  canPublish: boolean
}

export interface AuditReportFields {
  network?: string
  mintFunction?: boolean | null
  proxyContract?: boolean | null
  selfDestruct?: boolean | null
  supplyType?: "MINTABLE" | "FIXED" | "DEFLATIONARY" | string
  centralizationLevel?: "Low" | "Medium" | "High" | string
  compilerVersion?: string
  ozVersion?: string
  threatModelText?: string
  auditDateStart?: string
  auditDateEnd?: string
  durationDays?: number
  engineeringHours?: number
  numberOfAuditors?: number
  linesOfCode?: number
  codeSecurityScore?: number
  architectureScore?: number
  governanceScore?: number
  onChainScore?: number
  economicScore?: number
  operationsScore?: number
  finalScore?: number
  findings?: { severity: string; status: string }[]
  ownerVerification?: string
}

const NON_EVM_CHAINS = ["Solana", "Sui", "Aptos", "Cosmos", "Injective", "Sei", "Near", "Ton", "Starknet"]

function hasMintRoleSystem(src: string): boolean {
  return /isMinter|changeMinter|_setMinter|MinterRole|onlyMinter|MINTER_ROLE|addMinter|removeMinter/i.test(src)
}

function hasExternalMintFunction(src: string): boolean {
  return /function\s+\w*[Mm]int\s*\([^)]*\)\s*(public|external)/i.test(src)
}

function hasConstructorOnlyMint(src: string): boolean {
  if (!/_mint|mint/i.test(src)) return false
  if (hasMintRoleSystem(src)) return false
  if (hasExternalMintFunction(src)) return false
  return true
}

function hasPauseCapability(src: string): boolean {
  return (
    /function\s+pause\s*\(/i.test(src) ||
    /contract\s+Pausable/i.test(src) ||
    /PauserRole|OwnedPausable|OwnedPausalbe|whenNotPaused/i.test(src)
  )
}

export function validateAuditReport(
  sourceCode: string,
  reportFields: AuditReportFields,
  compilerVersionFromExplorer?: string,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const autoFixes: Record<string, unknown> = {}
  const src = sourceCode
  const isNonEVM = NON_EVM_CHAINS.includes(reportFields.network || "Ethereum")

  function push(check: ValidationIssue | null) {
    if (!check) return
    issues.push(check)
    if (check.autoFixable && check.autoFixValue !== undefined) {
      autoFixes[check.field] = check.autoFixValue
    }
  }

  if (!isNonEVM) {
    push(checkMintFunction(src, reportFields))
    push(checkSupplyBadge(src, reportFields))
    push(checkPauseFunction(src, reportFields))
    push(checkSelfDestruct(src, reportFields))
    push(checkProxy(src, reportFields))
    push(checkCompilerVersion(src, reportFields, compilerVersionFromExplorer))
    push(checkOZCompatibility(src, reportFields))
    push(checkThreatModel(src, reportFields))
    push(checkCentralization(src, reportFields))
  }

  push(checkDuration(reportFields))
  push(checkEngineeringHours(reportFields))
  push(checkLOCvsHours(reportFields))
  push(checkScoreMath(reportFields))

  const criticals = issues.filter(i => i.severity === "CRITICAL").length
  const highs     = issues.filter(i => i.severity === "HIGH").length
  const mediums   = issues.filter(i => i.severity === "MEDIUM").length
  const lows      = issues.filter(i => i.severity === "LOW").length
  const score     = Math.max(0, 100 - criticals * 25 - highs * 15 - mediums * 8 - lows * 3)
  const canPublish = criticals === 0 && highs === 0

  return { issues, autoFixes, score, canPublish }
}

// ── 1. Mint Function ──────────────────────────────────────────
function checkMintFunction(src: string, report: AuditReportFields): ValidationIssue | null {
  const hasMintExternal     = hasExternalMintFunction(src)
  const hasMinterRole       = hasMintRoleSystem(src)
  const hasOnlyConstructor  = hasConstructorOnlyMint(src)
  const reportSaysNo        = report.mintFunction === false
  const reportSaysYes       = report.mintFunction === true

  if ((hasMintExternal || hasMinterRole) && reportSaysNo) {
    return {
      id: "mint-function-false-negative",
      severity: "CRITICAL",
      field: "mintFunction",
      expected: "true (mint capability detected)",
      found: "false",
      detail: hasMinterRole
        ? "Rilevato sistema minter: isMinter / changeMinter / MinterRole / MINTER_ROLE. Il contratto puo emettere nuovi token."
        : "Funzione mint() pubblica/esterna presente. Visibile chiunque su Etherscan.",
      fix: 'Imposta "Mint Function" = Yes. Aggiungi finding M-01 "Centralized Minting Authority".',
      autoFixable: true,
      autoFixValue: true,
    }
  }

  if (hasOnlyConstructor && reportSaysYes) {
    return {
      id: "mint-function-false-positive",
      severity: "MEDIUM",
      field: "mintFunction",
      expected: "false (solo constructor mint = supply fisso)",
      found: "true",
      detail: "Il mint avviene solo nel constructor. Non esiste funzione mint esterna. Supply fissa.",
      fix: 'Imposta "Mint Function" = No. Aggiungi I-01 "Fixed Supply (Constructor-Only Mint)".',
      autoFixable: true,
      autoFixValue: false,
    }
  }

  return null
}

// ── 2. Supply Badge ───────────────────────────────────────────
function checkSupplyBadge(src: string, report: AuditReportFields): ValidationIssue | null {
  const hasMintExternal   = hasExternalMintFunction(src)
  const hasMinterRole     = hasMintRoleSystem(src)
  const hasConstructor    = hasConstructorOnlyMint(src)
  const hasBurn           = /function\s+burn\s*\(/i.test(src)
  const noMintAtAll       = !hasMintExternal && !hasMinterRole && !hasConstructor
  const supply            = report.supplyType?.toUpperCase()

  if ((hasMintExternal || hasMinterRole) && supply !== "MINTABLE") {
    return {
      id: "supply-badge-wrong",
      severity: "HIGH",
      field: "supplyType",
      expected: "MINTABLE",
      found: supply || "(non impostato)",
      detail: "Capacita mint rilevata ma il badge SUPPLY non e MINTABLE.",
      fix: 'Imposta SUPPLY = "MINTABLE" nella Section 5.',
      autoFixable: true,
      autoFixValue: "MINTABLE",
    }
  }

  if (hasConstructor && !hasMintExternal && !hasMinterRole && supply === "MINTABLE") {
    return {
      id: "supply-badge-mintable-wrong",
      severity: "MEDIUM",
      field: "supplyType",
      expected: "FIXED (solo constructor mint)",
      found: "MINTABLE",
      detail: "Mint solo nel constructor = supply fissa. Badge MINTABLE e errato.",
      fix: 'Imposta SUPPLY = "FIXED".',
      autoFixable: true,
      autoFixValue: "FIXED",
    }
  }

  if (hasBurn && !hasMintExternal && !hasMinterRole && supply === "MINTABLE") {
    return {
      id: "supply-badge-deflationary",
      severity: "LOW",
      field: "supplyType",
      expected: "DEFLATIONARY (solo burn, no mint esterno)",
      found: "MINTABLE",
      detail: "Solo burn function presente — supply deflazionaria, non mintable.",
      fix: 'Imposta SUPPLY = "DEFLATIONARY" o "FIXED".',
      autoFixable: false,
    }
  }

  if (noMintAtAll && supply === "MINTABLE") {
    return {
      id: "supply-badge-no-mint",
      severity: "HIGH",
      field: "supplyType",
      expected: "FIXED (nessuna capacita mint)",
      found: "MINTABLE",
      detail: "Nessuna funzione mint trovata nel contratto, ma badge = MINTABLE.",
      fix: 'Imposta SUPPLY = "FIXED".',
      autoFixable: true,
      autoFixValue: "FIXED",
    }
  }

  return null
}

// ── 3. Pause Function ─────────────────────────────────────────
function checkPauseFunction(src: string, report: AuditReportFields): ValidationIssue | null {
  const hasPause      = hasPauseCapability(src)
  const hasPauseMention = report.threatModelText
    ? /pause|pausable/i.test(report.threatModelText)
    : false

  if (hasPause && !hasPauseMention) {
    return {
      id: "pause-finding-missing",
      severity: "HIGH",
      field: "findings",
      expected: "Finding per Pause/Pausable authority",
      found: "Nessun riferimento alla pause function",
      detail: "Contratto eredita Pausable/PauserRole. Il pauser puo bloccare tutti i trasferimenti — rischio centralizzazione verificabile su Etherscan.",
      fix: 'Aggiungi M-01 "Centralized Pause Authority". Imposta CENTRALIZATION LEVEL = Medium.',
      autoFixable: false,
    }
  }

  return null
}

// ── 4. Self Destruct ──────────────────────────────────────────
function checkSelfDestruct(src: string, report: AuditReportFields): ValidationIssue | null {
  const hasSD       = /selfdestruct\s*\(|suicide\s*\(/i.test(src)
  const reportSaysNo = report.selfDestruct === false

  if (hasSD && reportSaysNo) {
    return {
      id: "self-destruct-false-negative",
      severity: "CRITICAL",
      field: "selfDestruct",
      expected: "true (selfdestruct rilevato)",
      found: "false",
      detail: "selfdestruct() o suicide() presenti — il report dice No.",
      fix: 'Imposta "Self Destruct" = Yes. Aggiungi finding H-01 "Self Destruct Capability".',
      autoFixable: true,
      autoFixValue: true,
    }
  }

  return null
}

// ── 5. Proxy ──────────────────────────────────────────────────
function checkProxy(src: string, report: AuditReportFields): ValidationIssue | null {
  const hasProxy    = /delegatecall|TransparentUpgradeableProxy|UUPSUpgradeable|ERC1967|_implementation\s*\(\)|ProxyAdmin/i.test(src)
  const reportSaysNo = report.proxyContract === false

  if (hasProxy && reportSaysNo) {
    return {
      id: "proxy-false-negative",
      severity: "HIGH",
      field: "proxyContract",
      expected: "true (pattern upgradeable rilevato)",
      found: "false",
      detail: "Pattern proxy rilevato (delegatecall / UUPSUpgradeable / TransparentProxy / ERC1967).",
      fix: 'Imposta "Proxy Contract" = Yes. Aggiungi finding per upgrade centralization.',
      autoFixable: true,
      autoFixValue: true,
    }
  }

  return null
}

// ── 6. Compiler Version ───────────────────────────────────────
function checkCompilerVersion(
  src: string,
  report: AuditReportFields,
  explorerVersion?: string,
): ValidationIssue | null {
  const pragmaMatch     = src.match(/pragma\s+solidity\s+[\^~>=<]*\s*([\d.]+)/i)
  const pragmaVersion   = pragmaMatch ? pragmaMatch[1] : null
  const referenceVersion = explorerVersion
    ? explorerVersion.replace(/v/, "").split("+")[0]
    : pragmaVersion

  if (!referenceVersion || !report.compilerVersion) return null

  const reportClean = report.compilerVersion.replace(/solc\s*/i, "").replace(/v/, "").trim()
  const refParts    = referenceVersion.split(".").slice(0, 3).join(".")
  const reportParts = reportClean.split(".").slice(0, 3).join(".")

  if (refParts !== reportParts) {
    return {
      id: "compiler-version-mismatch",
      severity: "MEDIUM",
      field: "compilerVersion",
      expected: `solc ${referenceVersion}${explorerVersion ? " (da Etherscan)" : " (da pragma)"}`,
      found: `solc ${reportClean}`,
      detail: explorerVersion
        ? `Etherscan mostra compiler: ${explorerVersion}`
        : `Pragma nel codice specifica: ${pragmaVersion}`,
      fix: `Aggiorna Compiler Version a "solc ${referenceVersion}".`,
      autoFixable: true,
      autoFixValue: `solc ${referenceVersion}`,
    }
  }

  return null
}

// ── 7. OZ Compatibility ───────────────────────────────────────
function checkOZCompatibility(src: string, report: AuditReportFields): ValidationIssue | null {
  if (!report.ozVersion) return null
  const pragmaMatch = src.match(/pragma\s+solidity\s+[\^~>=<]*\s*([\d.]+)/i)
  if (!pragmaMatch) return null

  const minor = parseInt(pragmaMatch[1].split(".")[1])
  const oz    = report.ozVersion

  if ((oz.includes("v4") || oz.includes("4.x")) && minor < 6) {
    return {
      id: "oz-version-incompatible",
      severity: "MEDIUM",
      field: "ozVersion",
      expected: `OpenZeppelin v2.x o v3.x (solc 0.${minor}.x)`,
      found: oz,
      detail: `OZ v4.x richiede Solidity >=0.6.0. Incompatibile con solc 0.${minor}.x.`,
      fix: "Verifica la vera versione OZ su Etherscan e aggiorna il campo.",
      autoFixable: false,
    }
  }

  if ((oz.includes("v3") || oz.includes("3.x")) && minor < 5) {
    return {
      id: "oz-version-incompatible-v3",
      severity: "MEDIUM",
      field: "ozVersion",
      expected: `OpenZeppelin v2.x (solc 0.${minor}.x)`,
      found: oz,
      detail: `OZ v3.x richiede Solidity >=0.5.0. Incompatibile con solc 0.${minor}.x.`,
      fix: "Aggiorna OZ version a v2.x.",
      autoFixable: true,
      autoFixValue: "OpenZeppelin Contracts v2.x",
    }
  }

  return null
}

// ── 8. Threat Model vs Mint ───────────────────────────────────
function checkThreatModel(src: string, report: AuditReportFields): ValidationIssue | null {
  if (!report.threatModelText) return null

  const hasMintExternal = hasExternalMintFunction(src)
  const hasMinterRole   = hasMintRoleSystem(src)
  const saysNoMint      = /no mint function|fixed supply model with no mint|supply is fixed at deployment|no mint\(\) function found/i.test(report.threatModelText)

  if ((hasMintExternal || hasMinterRole) && saysNoMint) {
    return {
      id: "threat-model-mint-contradiction",
      severity: "CRITICAL",
      field: "threatModelText",
      expected: "Threat model deve riflettere supply MINTABLE con ruolo minter",
      found: '"No mint function present" nel Threat Model',
      detail: "Il Threat Model nega la mint function ma il codice la contiene. Contraddizione verificabile su Etherscan.",
      fix: 'Rimuovi "No mint function present" dal Threat Model. Cambia stato Supply Manipulation in UNMITIGATED.',
      autoFixable: false,
    }
  }

  return null
}

// ── 9. Centralization vs Features ────────────────────────────
function checkCentralization(src: string, report: AuditReportFields): ValidationIssue | null {
  const hasPause      = hasPauseCapability(src)
  const hasMintExt    = hasExternalMintFunction(src)
  const hasMinterRole = hasMintRoleSystem(src)
  const cl            = report.centralizationLevel

  if ((hasPause || hasMintExt || hasMinterRole) && cl === "Low") {
    const reason = hasMintExt || hasMinterRole ? "ruolo minter attivo" : "pause function attiva"
    return {
      id: "centralization-understated",
      severity: "MEDIUM",
      field: "centralizationLevel",
      expected: `Medium (contratto ha ${reason})`,
      found: "Low",
      detail: `Con ${reason} il contratto non puo essere classificato "Low" centralizzazione.`,
      fix: 'Imposta CENTRALIZATION LEVEL = "Medium". Abbassa Governance Score a ~72-80.',
      autoFixable: true,
      autoFixValue: "Medium",
    }
  }

  return null
}

// ── 10. Duration vs Date Range ────────────────────────────────
function checkDuration(report: AuditReportFields): ValidationIssue | null {
  if (!report.auditDateStart || !report.auditDateEnd || !report.durationDays) return null

  const start    = new Date(report.auditDateStart)
  const end      = new Date(report.auditDateEnd)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const reported = report.durationDays

  if (diffDays !== reported) {
    return {
      id: "duration-date-mismatch",
      severity: "LOW",
      field: "durationDays",
      expected: `${diffDays} giorno/i (${report.auditDateStart} -> ${report.auditDateEnd})`,
      found: `${reported} giorno/i`,
      detail: `Il range di date implica ${diffDays} giorno/i ma Duration dice ${reported}.`,
      fix: `Imposta Duration = ${diffDays}, oppure correggi le date.`,
      autoFixable: true,
      autoFixValue: diffDays,
    }
  }

  return null
}

// ── 11. Engineering Hours vs Duration ────────────────────────
function checkEngineeringHours(report: AuditReportFields): ValidationIssue | null {
  if (!report.engineeringHours || !report.durationDays || !report.numberOfAuditors) return null

  const maxHours = report.durationDays * report.numberOfAuditors * 10
  const hours    = report.engineeringHours

  if (hours > maxHours) {
    return {
      id: "engineering-hours-impossible",
      severity: "HIGH",
      field: "engineeringHours",
      expected: `<= ${maxHours}h (${report.durationDays}d x ${report.numberOfAuditors} auditor x 10h)`,
      found: `${hours}h`,
      detail: `${hours}h in ${report.durationDays} giorno/i con ${report.numberOfAuditors} auditor e fisicamente impossibile.`,
      fix: `Riduci a max ${maxHours}h, oppure aumenta giorni/auditor.`,
      autoFixable: true,
      autoFixValue: maxHours,
    }
  }

  return null
}

// ── 12. LOC vs Manual Review Hours ───────────────────────────
function checkLOCvsHours(report: AuditReportFields): ValidationIssue | null {
  if (!report.linesOfCode || !report.engineeringHours) return null

  const loc   = report.linesOfCode
  const hours = report.engineeringHours

  if (loc < 50 && hours > 4) {
    return {
      id: "loc-hours-disproportionate",
      severity: "LOW",
      field: "engineeringHours",
      expected: `<= 4h per ${loc} LOC`,
      found: `${hours}h`,
      detail: `${hours}h di review per ${loc} LOC non e credibile. Un auditor esperto ci impiega 1-2h.`,
      fix: "Riduci a 2-4h per contratti sotto 50 LOC.",
      autoFixable: false,
    }
  }

  if (loc < 200 && hours > 16) {
    return {
      id: "loc-hours-high",
      severity: "LOW",
      field: "engineeringHours",
      expected: `8-16h per ${loc} LOC`,
      found: `${hours}h`,
      detail: `${hours}h per ${loc} LOC e fuori range e riduce la credibilita del report.`,
      fix: "Considera di ridurre a 8-16h per contratti sotto 200 LOC.",
      autoFixable: false,
    }
  }

  return null
}

// ── 13. Score Math ────────────────────────────────────────────
function checkScoreMath(report: AuditReportFields): ValidationIssue | null {
  const {
    codeSecurityScore, architectureScore, governanceScore,
    onChainScore, economicScore, operationsScore, finalScore, findings,
  } = report

  if (!codeSecurityScore || !architectureScore || !governanceScore ||
      !onChainScore || !economicScore || !operationsScore || !finalScore) return null

  const baseScore = (
    codeSecurityScore * 0.35 +
    architectureScore * 0.20 +
    governanceScore   * 0.15 +
    onChainScore      * 0.10 +
    economicScore     * 0.10 +
    operationsScore   * 0.10
  )

  const penalties = (findings || [])
    .filter(f => f.status === "OPEN")
    .reduce((acc, f) => {
      if (f.severity === "CRITICAL") return acc - 25
      if (f.severity === "HIGH")     return acc - 10
      if (f.severity === "MEDIUM")   return acc - 3
      if (f.severity === "LOW")      return acc - 1
      return acc
    }, 0)

  const expectedScore = Math.round(baseScore + penalties)

  if (Math.abs(expectedScore - finalScore) > 1) {
    return {
      id: "score-math-wrong",
      severity: "HIGH",
      field: "finalScore",
      expected: `${expectedScore} (base ${Math.round(baseScore)} + penalita ${penalties})`,
      found: `${finalScore}`,
      detail: `Score atteso: (${codeSecurityScore}x0.35 + ${architectureScore}x0.20 + ${governanceScore}x0.15 + ${onChainScore}x0.10 + ${economicScore}x0.10 + ${operationsScore}x0.10) + penalita = ${expectedScore}`,
      fix: `Aggiorna finalScore a ${expectedScore}.`,
      autoFixable: true,
      autoFixValue: expectedScore,
    }
  }

  return null
}
