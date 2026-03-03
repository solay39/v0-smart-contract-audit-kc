"use client"

import { useState, useRef } from "react"

// ─── BLOCKCHAIN CONFIG ───────────────────────────────────────────────────────
const CHAINS: Record<string, { name: string; symbol: string; explorer: string; explorerUI: string; apiKey: string; color: string }> = {
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    explorer: "https://api.etherscan.io/api",
    explorerUI: "https://etherscan.io",
    apiKey: "YourEtherscanAPIKey",
    color: "#627EEA",
  },
  bsc: {
    name: "BNB Chain",
    symbol: "BNB",
    explorer: "https://api.bscscan.com/api",
    explorerUI: "https://bscscan.com",
    apiKey: "YourBscscanAPIKey",
    color: "#F3BA2F",
  },
  polygon: {
    name: "Polygon",
    symbol: "MATIC",
    explorer: "https://api.polygonscan.com/api",
    explorerUI: "https://polygonscan.com",
    apiKey: "YourPolygonscanAPIKey",
    color: "#8247E5",
  },
  avalanche: {
    name: "Avalanche",
    symbol: "AVAX",
    explorer: "https://api.snowtrace.io/api",
    explorerUI: "https://snowtrace.io",
    apiKey: "YourSnowtraceAPIKey",
    color: "#E84142",
  },
  arbitrum: {
    name: "Arbitrum",
    symbol: "ARB",
    explorer: "https://api.arbiscan.io/api",
    explorerUI: "https://arbiscan.io",
    apiKey: "YourArbiscanAPIKey",
    color: "#28A0F0",
  },
  optimism: {
    name: "Optimism",
    symbol: "OP",
    explorer: "https://api-optimistic.etherscan.io/api",
    explorerUI: "https://optimistic.etherscan.io",
    apiKey: "YourOptimisticAPIKey",
    color: "#FF0420",
  },
  base: {
    name: "Base",
    symbol: "BASE",
    explorer: "https://api.basescan.org/api",
    explorerUI: "https://basescan.org",
    apiKey: "YourBasescanAPIKey",
    color: "#0052FF",
  },
  fantom: {
    name: "Fantom",
    symbol: "FTM",
    explorer: "https://api.ftmscan.com/api",
    explorerUI: "https://ftmscan.com",
    apiKey: "YourFtmscanAPIKey",
    color: "#1969FF",
  },
}

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface ValidationIssue {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  field: string
  expected: string
  found: string
  detail: string
  fix: string
}

interface ValidationSuggestion {
  severity: string
  field: string
  detail: string
  suggestion: string
}

interface ReportData {
  mintFunction: string
  proxyContract: string
  selfDestruct: string
  ownershipRenounced: string
  centralizationLevel: string
  compilerVersion: string
  ozVersion: string
  threatModelText: string
  auditDateStart: string
  auditDateEnd: string
  durationDays: string
  ownerVerification: string
  findings: { title: string; description: string }[]
}

interface ContractInfo {
  contractName: string
  compilerVersion: string
  sourceCode: string
  abi: unknown[]
  verified: boolean
}

interface AnalysisResult {
  issues: ValidationIssue[]
  findings: ValidationSuggestion[]
}

// ─── ANALYSIS ENGINE ─────────────────────────────────────────────────────────
function analyzeSourceCode(sourceCode: string, reportData: Partial<ReportData> & { mintFunction?: boolean | string | null; proxyContract?: boolean | string | null; selfDestruct?: boolean | string | null; ownershipRenounced?: boolean | string | null }): AnalysisResult {
  const issues: ValidationIssue[] = []
  const findings: ValidationSuggestion[] = []
  const srcRaw = sourceCode

  // ── 1. MINT FUNCTION ──────────────────────────────────────────────────────
  const hasMintExternal =
    /function\s+mint\s*\(/i.test(srcRaw) ||
    /function\s+mintTo\s*\(/i.test(srcRaw) ||
    /function\s+mintTokens\s*\(/i.test(srcRaw)

  const hasMinterRole =
    /isMinter|changeMinter|_setMinter|MinterRole|onlyMinter/i.test(srcRaw)

  const hasMintInConstructorOnly = (() => {
    const constructorMatch = srcRaw.match(
      /constructor\s*\([^)]*\)\s*(?:public|internal)?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/i
    )
    const mintOnlyInConstructor =
      constructorMatch &&
      /_mint\s*\(/i.test(constructorMatch[1]) &&
      !hasMintExternal &&
      !hasMinterRole
    return mintOnlyInConstructor
  })()

  const reportSaysMintNo =
    reportData?.mintFunction === false ||
    reportData?.mintFunction === "No" ||
    reportData?.mintFunction === "no"

  const reportSaysMintYes =
    reportData?.mintFunction === true ||
    reportData?.mintFunction === "Yes" ||
    reportData?.mintFunction === "yes"

  if ((hasMintExternal || hasMinterRole) && reportSaysMintNo) {
    issues.push({
      severity: "CRITICAL",
      field: "Mint Function",
      expected: "Yes (external mint or minter role detected)",
      found: "No",
      detail: hasMinterRole
        ? "Minter role functions detected: isMinter/changeMinter/_setMinter"
        : "External mint() function detected",
      fix: 'Set Mint Function = "Yes" with ATTENTION flag. Add M-01 "Centralized Minting Authority" finding.',
    })
  }

  if (hasMintInConstructorOnly && reportSaysMintYes) {
    issues.push({
      severity: "LOW",
      field: "Mint Function",
      expected: "No (only constructor-only mint detected)",
      found: "Yes",
      detail: "Mint only occurs in constructor — fixed supply pattern",
      fix: 'Set Mint Function = "No". Add I-02 "Fixed Supply (Constructor-Only Mint)" info finding.',
    })
  }

  // ── 2. PAUSE FUNCTION ─────────────────────────────────────────────────────
  const hasPause =
    /function\s+pause\s*\(/i.test(srcRaw) ||
    /contract\s+Pausable/i.test(srcRaw) ||
    /PauserRole|OwnedPausable|OwnedPausalbe|whenNotPaused|whenPaused/i.test(srcRaw)

  const reportMentionsPause =
    reportData?.findings?.some(
      (f) => /pause/i.test(f.title) || /pause/i.test(f.description)
    ) || false

  if (hasPause && !reportMentionsPause) {
    issues.push({
      severity: "HIGH",
      field: "Pause Function",
      expected: "Finding required for Pausable contract",
      found: "No pause-related finding in report",
      detail: "Contract inherits Pausable — owner/pauser can block all transfers. This is a centralization risk.",
      fix: 'Add M-01 "Centralized Pause Authority" finding. Update CENTRALIZATION LEVEL to Medium.',
    })
  }

  // ── 3. SELF DESTRUCT ──────────────────────────────────────────────────────
  const hasSelfDestruct = /selfdestruct\s*\(|suicide\s*\(/i.test(srcRaw)

  const reportSaysSelfDestructNo =
    reportData?.selfDestruct === false || reportData?.selfDestruct === "No"

  if (hasSelfDestruct && reportSaysSelfDestructNo) {
    issues.push({
      severity: "CRITICAL",
      field: "Self Destruct",
      expected: "Yes (selfdestruct() detected)",
      found: "No",
      detail: "selfdestruct() or suicide() found in contract",
      fix: 'Set Self Destruct = "Yes" with ATTENTION. Add H-01 "Self Destruct Capability" finding.',
    })
  }

  // ── 4. PROXY PATTERN ─────────────────────────────────────────────────────
  const hasProxy =
    /delegatecall|TransparentUpgradeableProxy|UUPSUpgradeable|ERC1967|_implementation\s*\(\)|ProxyAdmin/i.test(srcRaw)

  const reportSaysProxyNo =
    reportData?.proxyContract === false || reportData?.proxyContract === "No"

  if (hasProxy && reportSaysProxyNo) {
    issues.push({
      severity: "HIGH",
      field: "Proxy Contract",
      expected: "Yes (proxy/upgradeable pattern detected)",
      found: "No",
      detail: "Upgradeable proxy pattern detected in contract",
      fix: 'Set Proxy Contract = "Yes". Add finding for upgrade centralization risk.',
    })
  }

  // ── 5. OWNERSHIP ─────────────────────────────────────────────────────────
  const hasOwnable =
    /contract\s+Ownable|onlyOwner|transferOwnership|renounceOwnership/i.test(srcRaw)

  const reportSaysNoOwner =
    reportData?.ownerVerification?.toLowerCase().includes("no owner role") ||
    reportData?.centralizationLevel === "Low"

  if (hasOwnable && reportSaysNoOwner && !hasPause) {
    issues.push({
      severity: "MEDIUM",
      field: "Owner Role",
      expected: "Owner role present (Ownable detected)",
      found: 'Report states "No owner role"',
      detail: "Contract inherits Ownable with owner privileges",
      fix: 'Update On-Chain verification: "Owner address identified". Review CENTRALIZATION section.',
    })
  }

  // ── 6. COMPILER VERSION ──────────────────────────────────────────────────
  const pragmaMatch = srcRaw.match(/pragma\s+solidity\s+[\^~>=<]*\s*([\d.]+)/i)
  const detectedPragma = pragmaMatch ? pragmaMatch[1] : null

  if (detectedPragma && reportData?.compilerVersion) {
    const reportCompiler = reportData.compilerVersion.replace("solc", "").replace("v", "").trim()
    const reportMajorMinor = reportCompiler.split(".").slice(0, 3).join(".")
    const detectedMajorMinor = detectedPragma.split(".").slice(0, 3).join(".")

    if (
      reportMajorMinor !== detectedMajorMinor &&
      !reportMajorMinor.startsWith(detectedMajorMinor.split(".").slice(0, 2).join("."))
    ) {
      issues.push({
        severity: "MEDIUM",
        field: "Compiler Version",
        expected: `solc ${detectedPragma} (from pragma)`,
        found: `solc ${reportCompiler} (in report)`,
        detail: "Compiler version in report does not match pragma in source",
        fix: `Update compiler version to match Etherscan: v${detectedPragma}+commitXXX`,
      })
    }
  }

  // ── 7. OZ VERSION COMPATIBILITY ──────────────────────────────────────────
  if (detectedPragma && reportData?.ozVersion) {
    const solMinor = parseInt(detectedPragma.split(".")[1])
    const ozVersion = reportData.ozVersion

    const isIncompatible =
      (ozVersion.includes("v4") || ozVersion.includes("4.x")) &&
      (parseInt(detectedPragma.split(".")[0]) === 0 && solMinor < 6)

    if (isIncompatible) {
      issues.push({
        severity: "MEDIUM",
        field: "OpenZeppelin Compatibility",
        expected: `OZ v2.x or v3.x (compatible with solc ${detectedPragma})`,
        found: `${ozVersion} (requires solc >= 0.6.0)`,
        detail: `OpenZeppelin v4.x requires Solidity >= 0.6.0 — incompatible with solc ${detectedPragma}`,
        fix: "Update OZ version in report to match actual dependency used.",
      })
    }
  }

  // ── 8. SUPPLY MODEL CONSISTENCY ──────────────────────────────────────────
  const threatModelText = reportData?.threatModelText || ""
  const saysNoMintInThreat =
    /no mint function|fixed supply model with no mint|supply is fixed at deployment/i.test(threatModelText)

  if ((hasMintExternal || hasMinterRole) && saysNoMintInThreat) {
    issues.push({
      severity: "CRITICAL",
      field: "Threat Model — Supply Scenario",
      expected: "Threat model should reflect MINTABLE supply",
      found: '"No mint function present" written in Threat Model',
      detail: "Threat model contradicts actual contract — mint capability exists",
      fix: 'Update Supply Manipulation scenario to UNMITIGATED. Remove "No mint function present".',
    })
  }

  // ── 9. BURN FUNCTION ─────────────────────────────────────────────────────
  const hasBurn =
    /function\s+burn\s*\(/i.test(srcRaw) || /function\s+_burn\s*\(/i.test(srcRaw)

  const reportMentionsBurn =
    reportData?.findings?.some((f) => /burn/i.test(f.title)) || false

  if (hasBurn && !reportMentionsBurn) {
    findings.push({
      severity: "INFO",
      field: "Burn Function",
      detail: "Contract has burn capability — supply is deflationary",
      suggestion: 'Add I-0X "Burn Function Present — Deflationary Supply" as informational finding.',
    })
  }

  // ── 10. DURATION CONSISTENCY ─────────────────────────────────────────────
  if (reportData?.durationDays && reportData?.auditDateStart && reportData?.auditDateEnd) {
    const start = new Date(reportData.auditDateStart)
    const end = new Date(reportData.auditDateEnd)
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const reportedDays = parseInt(reportData.durationDays)

    if (diffDays !== reportedDays) {
      issues.push({
        severity: "LOW",
        field: "Duration Consistency",
        expected: `${diffDays} day(s) based on dates`,
        found: `${reportedDays} day(s) stated in report`,
        detail: `Dates ${reportData.auditDateStart} → ${reportData.auditDateEnd} = ${diffDays} day(s), but report says ${reportedDays}`,
        fix: "Align Duration field with actual audit date range.",
      })
    }
  }

  return { issues, findings }
}

// ─── MOCK FETCH (real implementation would call Etherscan API) ───────────────
async function fetchContractData(_address: string, _chain: string): Promise<ContractInfo> {
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000))

  return {
    contractName: "ExampleToken",
    compilerVersion: "v0.6.12+commit.27d51765",
    sourceCode: `
pragma solidity ^0.6.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract ExampleToken is ERC20, Ownable {
  uint256 private _cap;
  address private _minter;
  constructor(uint256 cap_, address minter_) public ERC20("Example", "EXM") {
    _cap = cap_;
    _minter = minter_;
  }
  function isMinter(address account) public view returns (bool) { return account == _minter; }
  function changeMinter(address newMinter) public onlyOwner { _minter = newMinter; }
  function _mint(address account, uint256 amount) internal override {
    require(totalSupply() + amount <= _cap, "cap exceeded");
    require(msg.sender == _minter, "not minter");
    super._mint(account, amount);
  }
}`,
    abi: [],
    verified: true,
  }
}

// ─── SEVERITY CONFIG ─────────────────────────────────────────────────────────
const SEV: Record<string, { color: string; bg: string; label: string; order: number }> = {
  CRITICAL: { color: "#FF3B3B", bg: "#2D0A0A", label: "CRITICAL", order: 0 },
  HIGH: { color: "#FF8C00", bg: "#2D1800", label: "HIGH", order: 1 },
  MEDIUM: { color: "#FFD700", bg: "#2D2500", label: "MEDIUM", order: 2 },
  LOW: { color: "#00D4AA", bg: "#002D25", label: "LOW", order: 3 },
  INFO: { color: "#7B9FFF", bg: "#0A1530", label: "INFO", order: 4 },
}

// ─── STEPS ───────────────────────────────────────────────────────────────────
const STEPS_PROGRESS = [
  "Connecting to blockchain explorer...",
  "Fetching contract source code...",
  "Parsing ABI and functions...",
  "Analyzing mint/burn/pause patterns...",
  "Checking compiler version...",
  "Validating OpenZeppelin compatibility...",
  "Cross-referencing report data...",
  "Generating validation report...",
]

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Solay39Validator() {
  const [step, setStep] = useState<"input" | "analyzing" | "result">("input")
  const [chain, setChain] = useState("ethereum")
  const [address, setAddress] = useState("")
  const [reportData, setReportData] = useState<ReportData>({
    mintFunction: "",
    proxyContract: "",
    selfDestruct: "",
    ownershipRenounced: "",
    centralizationLevel: "",
    compilerVersion: "",
    ozVersion: "",
    threatModelText: "",
    auditDateStart: "",
    auditDateEnd: "",
    durationDays: "",
    ownerVerification: "",
    findings: [],
  })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState("")
  const [activeTab, setActiveTab] = useState("issues")
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function runAnalysis() {
    if (!address.trim()) return
    setStep("analyzing")
    setProgress(0)

    let idx = 0
    intervalRef.current = setInterval(() => {
      if (idx < STEPS_PROGRESS.length) {
        setProgressLabel(STEPS_PROGRESS[idx])
        setProgress(Math.round(((idx + 1) / STEPS_PROGRESS.length) * 90))
        idx++
      }
    }, 400)

    try {
      const data = await fetchContractData(address, chain)
      setContractInfo(data)

      if (intervalRef.current) clearInterval(intervalRef.current)
      setProgress(95)
      setProgressLabel("Running final checks...")

      await new Promise((r) => setTimeout(r, 500))

      const parsedReport = {
        ...reportData,
        mintFunction: reportData.mintFunction === "yes" ? true : reportData.mintFunction === "no" ? false : null,
        proxyContract: reportData.proxyContract === "yes" ? true : reportData.proxyContract === "no" ? false : null,
        selfDestruct: reportData.selfDestruct === "yes" ? true : reportData.selfDestruct === "no" ? false : null,
        ownershipRenounced: reportData.ownershipRenounced === "yes" ? true : reportData.ownershipRenounced === "no" ? false : null,
        findings: [] as { title: string; description: string }[],
      }

      const analysis = analyzeSourceCode(data.sourceCode, parsedReport)

      setProgress(100)
      setProgressLabel("Complete")
      await new Promise((r) => setTimeout(r, 400))

      setResult(analysis)
      setStep("result")
    } catch (e) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setStep("input")
      alert("Error fetching contract: " + (e instanceof Error ? e.message : "Unknown error"))
    }
  }

  function reset() {
    setStep("input")
    setResult(null)
    setContractInfo(null)
    setProgress(0)
    setAddress("")
    setActiveTab("issues")
  }

  const criticalCount = result?.issues?.filter((i) => i.severity === "CRITICAL").length || 0
  const highCount = result?.issues?.filter((i) => i.severity === "HIGH").length || 0
  const medCount = result?.issues?.filter((i) => i.severity === "MEDIUM").length || 0
  const lowCount = result?.issues?.filter((i) => i.severity === "LOW").length || 0

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050A0F",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      color: "#E0E6F0",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #0D2035",
        padding: "18px 32px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "rgba(5,10,15,0.95)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          width: 36, height: 36,
          background: "linear-gradient(135deg, #00D4AA, #0066FF)",
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 900,
        }}>S</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: "#00D4AA" }}>SOLAY39</div>
          <div style={{ fontSize: 10, color: "#3A5070", letterSpacing: 2 }}>CONTRACT VALIDATION ENGINE</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {Object.entries(CHAINS).map(([key, c]) => (
            <div key={key} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: chain === key ? c.color : "#1A2840",
              transition: "all 0.2s",
            }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* ── INPUT STEP ── */}
        {step === "input" && (
          <div>
            <div style={{ marginBottom: 40, textAlign: "center" }}>
              <div style={{
                fontSize: 11, letterSpacing: 4, color: "#00D4AA",
                marginBottom: 12, textTransform: "uppercase",
              }}>Audit Validation System v2.0</div>
              <h1 style={{
                fontSize: 32, fontWeight: 900, margin: 0,
                background: "linear-gradient(135deg, #E0E6F0, #00D4AA)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Contract Validator</h1>
              <p style={{ color: "#3A5070", fontSize: 13, marginTop: 8 }}>
                Verifica automatica contratti vs report audit — elimina errori prima della pubblicazione
              </p>
            </div>

            {/* Chain selector */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, letterSpacing: 3, color: "#3A5070", display: "block", marginBottom: 10 }}>
                BLOCKCHAIN
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(CHAINS).map(([key, c]) => (
                  <button key={key} onClick={() => setChain(key)} style={{
                    padding: "8px 16px",
                    background: chain === key ? `${c.color}22` : "#0A1520",
                    border: `1px solid ${chain === key ? c.color : "#0D2035"}`,
                    borderRadius: 6,
                    color: chain === key ? c.color : "#3A5070",
                    fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "inherit",
                  }}>{c.name}</button>
                ))}
              </div>
            </div>

            {/* Address input */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, letterSpacing: 3, color: "#3A5070", display: "block", marginBottom: 10 }}>
                CONTRACT ADDRESS
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#080E18", border: "1px solid #0D2035",
                  borderRadius: 8, padding: "14px 16px",
                  color: "#00D4AA", fontSize: 13, fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>

            {/* Report data */}
            <div style={{
              background: "#080E18", border: "1px solid #0D2035",
              borderRadius: 12, padding: 24, marginBottom: 24,
            }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#3A5070", marginBottom: 20 }}>
                DATI DAL REPORT AUDIT (opzionale ma consigliato)
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {([
                  { key: "mintFunction" as const, label: "Mint Function nel report", opts: ["", "yes", "no"] },
                  { key: "proxyContract" as const, label: "Proxy Contract nel report", opts: ["", "yes", "no"] },
                  { key: "selfDestruct" as const, label: "Self Destruct nel report", opts: ["", "yes", "no"] },
                  { key: "ownershipRenounced" as const, label: "Ownership Renounced", opts: ["", "yes", "no"] },
                  { key: "centralizationLevel" as const, label: "Centralization Level", opts: ["", "Low", "Medium", "High"] },
                ]).map(({ key, label, opts }) => (
                  <div key={key}>
                    <label style={{ fontSize: 10, color: "#3A5070", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                      {label.toUpperCase()}
                    </label>
                    <select
                      value={reportData[key]}
                      onChange={(e) => setReportData((p) => ({ ...p, [key]: e.target.value }))}
                      style={{
                        width: "100%", background: "#050A0F",
                        border: "1px solid #0D2035", borderRadius: 6,
                        padding: "8px 12px", color: "#E0E6F0",
                        fontSize: 12, fontFamily: "inherit", outline: "none",
                      }}
                    >
                      {opts.map((o) => <option key={o} value={o}>{o || "— non specificato —"}</option>)}
                    </select>
                  </div>
                ))}

                <div>
                  <label style={{ fontSize: 10, color: "#3A5070", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                    COMPILER VERSION (nel report)
                  </label>
                  <input
                    value={reportData.compilerVersion}
                    onChange={(e) => setReportData((p) => ({ ...p, compilerVersion: e.target.value }))}
                    placeholder="es. solc 0.6.0"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#050A0F", border: "1px solid #0D2035",
                      borderRadius: 6, padding: "8px 12px",
                      color: "#E0E6F0", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, color: "#3A5070", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                    OZ VERSION (nel report)
                  </label>
                  <input
                    value={reportData.ozVersion}
                    onChange={(e) => setReportData((p) => ({ ...p, ozVersion: e.target.value }))}
                    placeholder="es. v4.x"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#050A0F", border: "1px solid #0D2035",
                      borderRadius: 6, padding: "8px 12px",
                      color: "#E0E6F0", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, color: "#3A5070", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                    AUDIT DATE START
                  </label>
                  <input
                    type="date"
                    value={reportData.auditDateStart}
                    onChange={(e) => setReportData((p) => ({ ...p, auditDateStart: e.target.value }))}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#050A0F", border: "1px solid #0D2035",
                      borderRadius: 6, padding: "8px 12px",
                      color: "#E0E6F0", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, color: "#3A5070", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                    AUDIT DATE END
                  </label>
                  <input
                    type="date"
                    value={reportData.auditDateEnd}
                    onChange={(e) => setReportData((p) => ({ ...p, auditDateEnd: e.target.value }))}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#050A0F", border: "1px solid #0D2035",
                      borderRadius: 6, padding: "8px 12px",
                      color: "#E0E6F0", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, color: "#3A5070", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                    DURATION (days nel report)
                  </label>
                  <input
                    type="number"
                    value={reportData.durationDays}
                    onChange={(e) => setReportData((p) => ({ ...p, durationDays: e.target.value }))}
                    placeholder="es. 1"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#050A0F", border: "1px solid #0D2035",
                      borderRadius: 6, padding: "8px 12px",
                      color: "#E0E6F0", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Threat model text */}
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 10, color: "#3A5070", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                  TESTO THREAT MODEL (incolla dal report)
                </label>
                <textarea
                  value={reportData.threatModelText}
                  onChange={(e) => setReportData((p) => ({ ...p, threatModelText: e.target.value }))}
                  placeholder="Incolla il testo degli Attack Scenarios dal report..."
                  rows={4}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#050A0F", border: "1px solid #0D2035",
                    borderRadius: 6, padding: "10px 12px",
                    color: "#E0E6F0", fontSize: 12, fontFamily: "inherit",
                    outline: "none", resize: "vertical",
                  }}
                />
              </div>
            </div>

            <button
              onClick={runAnalysis}
              disabled={!address.trim()}
              style={{
                width: "100%", padding: "16px",
                background: address.trim()
                  ? "linear-gradient(135deg, #00D4AA, #0066FF)"
                  : "#0A1520",
                border: "none", borderRadius: 10,
                color: address.trim() ? "#050A0F" : "#3A5070",
                fontSize: 13, fontWeight: 900, letterSpacing: 3,
                cursor: address.trim() ? "pointer" : "not-allowed",
                fontFamily: "inherit", transition: "all 0.2s",
              }}
            >
              {'RUN VALIDATION →'}
            </button>
          </div>
        )}

        {/* ── ANALYZING STEP ── */}
        {step === "analyzing" && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 80, height: 80, margin: "0 auto 32px",
              borderRadius: "50%",
              border: "3px solid #0D2035",
              borderTop: "3px solid #00D4AA",
              animation: "spin 1s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{ fontSize: 11, letterSpacing: 3, color: "#00D4AA", marginBottom: 8 }}>
              ANALYZING CONTRACT
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
            <div style={{ fontSize: 11, color: "#3A5070", marginBottom: 40 }}>
              {CHAINS[chain]?.name}
            </div>

            {/* Progress bar */}
            <div style={{
              maxWidth: 400, margin: "0 auto",
              background: "#0A1520", borderRadius: 4,
              height: 4, overflow: "hidden", marginBottom: 16,
            }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: "linear-gradient(90deg, #00D4AA, #0066FF)",
                width: `${progress}%`, transition: "width 0.3s ease",
              }} />
            </div>
            <div style={{ fontSize: 11, color: "#3A5070", letterSpacing: 1 }}>
              {progressLabel}
            </div>
          </div>
        )}

        {/* ── RESULT STEP ── */}
        {step === "result" && result && (
          <div>
            {/* Summary bar */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12, marginBottom: 32,
            }}>
              {[
                { label: "CRITICAL", count: criticalCount, ...SEV.CRITICAL },
                { label: "HIGH", count: highCount, ...SEV.HIGH },
                { label: "MEDIUM", count: medCount, ...SEV.MEDIUM },
                { label: "LOW", count: lowCount, ...SEV.LOW },
              ].map((s) => (
                <div key={s.label} style={{
                  background: s.count > 0 ? s.bg : "#0A1520",
                  border: `1px solid ${s.count > 0 ? s.color + "44" : "#0D2035"}`,
                  borderRadius: 10, padding: "16px",
                  textAlign: "center",
                }}>
                  <div style={{
                    fontSize: 28, fontWeight: 900,
                    color: s.count > 0 ? s.color : "#1A2840",
                  }}>{s.count}</div>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: s.count > 0 ? s.color : "#1A2840" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Contract info */}
            {contractInfo && (
              <div style={{
                background: "#080E18", border: "1px solid #0D2035",
                borderRadius: 10, padding: "16px 20px", marginBottom: 24,
                display: "flex", gap: 32, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 9, color: "#3A5070", letterSpacing: 2 }}>CONTRACT</div>
                  <div style={{ fontSize: 12, color: "#00D4AA", fontWeight: 700 }}>{contractInfo.contractName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#3A5070", letterSpacing: 2 }}>COMPILER</div>
                  <div style={{ fontSize: 12, color: "#E0E6F0" }}>{contractInfo.compilerVersion}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#3A5070", letterSpacing: 2 }}>CHAIN</div>
                  <div style={{ fontSize: 12, color: CHAINS[chain]?.color }}>{CHAINS[chain]?.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#3A5070", letterSpacing: 2 }}>VERIFIED</div>
                  <div style={{ fontSize: 12, color: contractInfo.verified ? "#00D4AA" : "#FF3B3B" }}>
                    {contractInfo.verified ? "YES" : "NO"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ fontSize: 9, color: "#3A5070", letterSpacing: 2 }}>OVERALL STATUS</div>
                  <div style={{
                    fontSize: 13, fontWeight: 900,
                    color: criticalCount > 0 ? "#FF3B3B" : highCount > 0 ? "#FF8C00" : medCount > 0 ? "#FFD700" : "#00D4AA",
                  }}>
                    {criticalCount > 0 ? "CRITICAL ISSUES" : highCount > 0 ? "HIGH ISSUES" : medCount > 0 ? "REVIEW NEEDED" : "CLEAN"}
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
              {[
                { id: "issues", label: `ISSUES (${result.issues.length})` },
                { id: "suggestions", label: `SUGGESTIONS (${result.findings.length})` },
              ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: "8px 20px",
                  background: activeTab === t.id ? "#0D2035" : "transparent",
                  border: `1px solid ${activeTab === t.id ? "#00D4AA44" : "#0D2035"}`,
                  borderRadius: 6, color: activeTab === t.id ? "#00D4AA" : "#3A5070",
                  fontSize: 10, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Issues list */}
            {activeTab === "issues" && (
              <div>
                {result.issues.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "60px 0",
                    color: "#00D4AA",
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{'OK'}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>No issues found</div>
                    <div style={{ fontSize: 11, color: "#3A5070", marginTop: 4 }}>
                      Report data is consistent with contract source
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[...result.issues]
                      .sort((a, b) => SEV[a.severity].order - SEV[b.severity].order)
                      .map((issue, i) => (
                        <div key={i} style={{
                          background: SEV[issue.severity].bg,
                          border: `1px solid ${SEV[issue.severity].color}33`,
                          borderLeft: `3px solid ${SEV[issue.severity].color}`,
                          borderRadius: 10, padding: "18px 20px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <span style={{
                              background: SEV[issue.severity].color + "22",
                              color: SEV[issue.severity].color,
                              fontSize: 9, fontWeight: 900, letterSpacing: 2,
                              padding: "3px 8px", borderRadius: 4,
                            }}>{issue.severity}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#E0E6F0" }}>
                              {issue.field}
                            </span>
                          </div>

                          <div style={{
                            display: "grid", gridTemplateColumns: "1fr 1fr",
                            gap: 12, marginBottom: 12,
                          }}>
                            <div style={{
                              background: "#00D4AA11", border: "1px solid #00D4AA22",
                              borderRadius: 6, padding: "10px 12px",
                            }}>
                              <div style={{ fontSize: 9, color: "#00D4AA", letterSpacing: 2, marginBottom: 4 }}>EXPECTED</div>
                              <div style={{ fontSize: 11, color: "#E0E6F0" }}>{issue.expected}</div>
                            </div>
                            <div style={{
                              background: "#FF3B3B11", border: "1px solid #FF3B3B22",
                              borderRadius: 6, padding: "10px 12px",
                            }}>
                              <div style={{ fontSize: 9, color: "#FF3B3B", letterSpacing: 2, marginBottom: 4 }}>FOUND IN REPORT</div>
                              <div style={{ fontSize: 11, color: "#E0E6F0" }}>{issue.found}</div>
                            </div>
                          </div>

                          <div style={{
                            background: "#050A0F", borderRadius: 6,
                            padding: "10px 12px", marginBottom: 10,
                            fontSize: 11, color: "#8A9BB0", lineHeight: 1.6,
                          }}>
                            {issue.detail}
                          </div>

                          <div style={{
                            background: "#FFD70011", border: "1px solid #FFD70033",
                            borderRadius: 6, padding: "10px 12px",
                          }}>
                            <span style={{ fontSize: 9, color: "#FFD700", letterSpacing: 2 }}>{'FIX → '}</span>
                            <span style={{ fontSize: 11, color: "#E0E6F0" }}>{issue.fix}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Suggestions list */}
            {activeTab === "suggestions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.findings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#3A5070" }}>
                    <div style={{ fontSize: 11 }}>No additional suggestions</div>
                  </div>
                ) : result.findings.map((f, i) => (
                  <div key={i} style={{
                    background: "#0A1520", border: "1px solid #0D2035",
                    borderLeft: "3px solid #7B9FFF",
                    borderRadius: 10, padding: "16px 20px",
                  }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <span style={{
                        background: "#7B9FFF22", color: "#7B9FFF",
                        fontSize: 9, fontWeight: 900, letterSpacing: 2,
                        padding: "3px 8px", borderRadius: 4,
                      }}>SUGGESTION</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{f.field}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#8A9BB0", marginBottom: 8 }}>{f.detail}</div>
                    <div style={{ fontSize: 11, color: "#7B9FFF" }}>{'→ '}{f.suggestion}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button onClick={reset} style={{
                flex: 1, padding: "14px",
                background: "transparent", border: "1px solid #0D2035",
                borderRadius: 8, color: "#3A5070",
                fontSize: 11, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
              }}>{'← NEW VALIDATION'}</button>

              <button onClick={() => {
                const report = {
                  address, chain: CHAINS[chain]?.name,
                  timestamp: new Date().toISOString(),
                  issues: result.issues,
                  suggestions: result.findings,
                }
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url; a.download = `solay39-validation-${address.slice(0, 8)}.json`
                a.click()
              }} style={{
                flex: 1, padding: "14px",
                background: "linear-gradient(135deg, #00D4AA22, #0066FF22)",
                border: "1px solid #00D4AA44",
                borderRadius: 8, color: "#00D4AA",
                fontSize: 11, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
              }}>{'EXPORT JSON ↓'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
