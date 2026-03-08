/**
 * Dependency Scanner - Analyzes contract dependencies and external calls
 * Detects OpenZeppelin, custom libraries, and cross-contract interactions
 */

export interface Dependency {
  name: string
  path: string
  version: string | null
  type: "openzeppelin" | "chainlink" | "uniswap" | "layerzero" | "custom" | "unknown"
  risk: "low" | "medium" | "high"
  reason: string
}

export interface ExternalCall {
  target: string
  method: string
  isStatic: boolean
  isDelegateCall: boolean
  isLowLevel: boolean
  lineNumber: number
  riskLevel: "low" | "medium" | "high" | "critical"
  context: string
}

export interface DependencyScanResult {
  dependencies: Dependency[]
  externalCalls: ExternalCall[]
  inheritanceChain: string[]
  knownVulnerableVersions: { name: string; version: string; cve: string }[]
  recommendations: string[]
}

// Known vulnerable versions of common libraries
const VULNERABLE_VERSIONS: Record<string, { versions: string[]; cve: string; severity: string }> = {
  "@openzeppelin/contracts": {
    versions: ["4.0.0", "4.1.0", "4.2.0", "4.3.0", "4.3.1", "4.3.2"],
    cve: "CVE-2022-35915",
    severity: "HIGH - Initializable reentrancy",
  },
  "@openzeppelin/contracts-upgradeable": {
    versions: ["4.0.0", "4.1.0", "4.2.0", "4.3.0"],
    cve: "CVE-2022-35915",
    severity: "HIGH - Initializable reentrancy",
  },
}

// Scan for dependencies
export function scanDependencies(code: string, imports: { path: string; symbols: string[] }[]): DependencyScanResult {
  const dependencies: Dependency[] = []
  const externalCalls: ExternalCall[] = []
  const inheritanceChain: string[] = []
  const knownVulnerableVersions: { name: string; version: string; cve: string }[] = []
  const recommendations: string[] = []

  // Analyze imports
  for (const imp of imports) {
    const dep = classifyDependency(imp.path)
    dependencies.push(dep)

    // Check for vulnerable versions (would need package.json in real implementation)
    if (dep.type === "openzeppelin" && VULNERABLE_VERSIONS["@openzeppelin/contracts"]) {
      recommendations.push(`Ensure OpenZeppelin contracts are updated to latest version (5.x recommended)`)
    }
  }

  // Extract inheritance chain
  const inheritsMatch = code.match(/contract\s+\w+\s+is\s+([^{]+)\{/)
  if (inheritsMatch) {
    inheritanceChain.push(...inheritsMatch[1].split(",").map(s => s.trim()))
  }

  // Scan for external calls
  const lines = code.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Low-level calls
    if (line.includes(".call(") || line.includes(".call{")) {
      externalCalls.push({
        target: extractTarget(line),
        method: "call",
        isStatic: false,
        isDelegateCall: false,
        isLowLevel: true,
        lineNumber: lineNum,
        riskLevel: "high",
        context: line.trim(),
      })
    }

    // Delegatecall
    if (line.includes(".delegatecall(")) {
      externalCalls.push({
        target: extractTarget(line),
        method: "delegatecall",
        isStatic: false,
        isDelegateCall: true,
        isLowLevel: true,
        lineNumber: lineNum,
        riskLevel: "critical",
        context: line.trim(),
      })
    }

    // Staticcall
    if (line.includes(".staticcall(")) {
      externalCalls.push({
        target: extractTarget(line),
        method: "staticcall",
        isStatic: true,
        isDelegateCall: false,
        isLowLevel: true,
        lineNumber: lineNum,
        riskLevel: "low",
        context: line.trim(),
      })
    }

    // Transfer/send
    if (line.includes(".transfer(") || line.includes(".send(")) {
      externalCalls.push({
        target: extractTarget(line),
        method: line.includes(".transfer(") ? "transfer" : "send",
        isStatic: false,
        isDelegateCall: false,
        isLowLevel: false,
        lineNumber: lineNum,
        riskLevel: "medium",
        context: line.trim(),
      })
    }

    // Interface calls (high-level)
    const interfaceCallMatch = line.match(/(\w+)\s*\(\s*\w+\s*\)\s*\.\s*(\w+)\s*\(/)
    if (interfaceCallMatch) {
      externalCalls.push({
        target: interfaceCallMatch[1],
        method: interfaceCallMatch[2],
        isStatic: false,
        isDelegateCall: false,
        isLowLevel: false,
        lineNumber: lineNum,
        riskLevel: "medium",
        context: line.trim(),
      })
    }
  }

  // Generate recommendations based on findings
  if (externalCalls.some(c => c.isDelegateCall)) {
    recommendations.push("CRITICAL: delegatecall detected - ensure target is trusted and cannot be changed")
  }
  if (externalCalls.some(c => c.isLowLevel && c.method === "call")) {
    recommendations.push("HIGH: Low-level call() detected - validate return value and handle failures")
  }
  if (inheritanceChain.length > 5) {
    recommendations.push("MEDIUM: Deep inheritance chain - consider flattening for readability")
  }

  return {
    dependencies,
    externalCalls,
    inheritanceChain,
    knownVulnerableVersions,
    recommendations,
  }
}

function classifyDependency(path: string): Dependency {
  const lowerPath = path.toLowerCase()

  if (lowerPath.includes("openzeppelin")) {
    return {
      name: path.split("/").pop() || path,
      path,
      version: null,
      type: "openzeppelin",
      risk: "low",
      reason: "OpenZeppelin is a trusted, audited library",
    }
  }

  if (lowerPath.includes("chainlink")) {
    return {
      name: path.split("/").pop() || path,
      path,
      version: null,
      type: "chainlink",
      risk: "low",
      reason: "Chainlink is a trusted oracle provider",
    }
  }

  if (lowerPath.includes("uniswap")) {
    return {
      name: path.split("/").pop() || path,
      path,
      version: null,
      type: "uniswap",
      risk: "medium",
      reason: "Uniswap interfaces - ensure proper slippage protection",
    }
  }

  if (lowerPath.includes("layerzero") || lowerPath.includes("oft") || lowerPath.includes("oapp")) {
    return {
      name: path.split("/").pop() || path,
      path,
      version: null,
      type: "layerzero",
      risk: "high",
      reason: "Cross-chain messaging - requires careful security review",
    }
  }

  if (path.startsWith("./") || path.startsWith("../")) {
    return {
      name: path.split("/").pop() || path,
      path,
      version: null,
      type: "custom",
      risk: "high",
      reason: "Custom code requires full audit",
    }
  }

  return {
    name: path.split("/").pop() || path,
    path,
    version: null,
    type: "unknown",
    risk: "high",
    reason: "Unknown dependency - verify source and security",
  }
}

function extractTarget(line: string): string {
  // Try to extract the target of the call
  const match = line.match(/(\w+)\s*\.(?:call|delegatecall|staticcall|transfer|send)/)
  if (match) return match[1]

  // Check for address(this) pattern
  if (line.includes("address(this)")) return "this"
  if (line.includes("msg.sender")) return "msg.sender"

  return "unknown"
}

// Detect cross-chain patterns
export function detectCrossChainPatterns(code: string): {
  isLayerZero: boolean
  isWormhole: boolean
  isAxelar: boolean
  isBridge: boolean
  patterns: string[]
} {
  const patterns: string[] = []

  const isLayerZero = /LayerZero|OFT|OAPP|ILayerZeroEndpoint|lzReceive|_lzSend/.test(code)
  const isWormhole = /Wormhole|IWormhole|publishMessage|parseAndVerifyVM/.test(code)
  const isAxelar = /Axelar|IAxelarGateway|IAxelarExecutable/.test(code)
  const isBridge = isLayerZero || isWormhole || isAxelar || /bridge|Bridge|crossChain|relayer/.test(code)

  if (isLayerZero) {
    patterns.push("LayerZero OFT/OAPP pattern detected")
    if (!/setPeer|trustedRemote/.test(code)) {
      patterns.push("WARNING: No peer configuration found - cross-chain messages may be spoofable")
    }
    if (!/lzReceive.*require/.test(code)) {
      patterns.push("WARNING: lzReceive lacks validation - verify message authenticity")
    }
  }

  if (isWormhole) {
    patterns.push("Wormhole bridge pattern detected")
    if (!/verifyVM|parseAndVerifyVM/.test(code)) {
      patterns.push("WARNING: VAA verification not found")
    }
  }

  if (isAxelar) {
    patterns.push("Axelar gateway pattern detected")
    if (!/_execute.*sourceChain/.test(code)) {
      patterns.push("WARNING: Source chain validation may be missing")
    }
  }

  return { isLayerZero, isWormhole, isAxelar, isBridge, patterns }
}

// Detect oracle dependencies
export function detectOracleUsage(code: string): {
  usesChainlink: boolean
  usesUniswapTWAP: boolean
  usesCustomOracle: boolean
  oraclePatterns: string[]
} {
  const oraclePatterns: string[] = []

  const usesChainlink = /AggregatorV3Interface|latestRoundData|latestAnswer/.test(code)
  const usesUniswapTWAP = /OracleLibrary|observe\(|consult\(|TWAP/.test(code)
  const usesAMM = /getReserves|slot0\(\)|sqrtPriceX96/.test(code)
  const usesCustomOracle = /oracle|Oracle|priceOracle|getPrice/.test(code) && !usesChainlink

  if (usesChainlink) {
    oraclePatterns.push("Chainlink oracle integration detected")
    if (!/require.*answer.*>.*0|updatedAt/.test(code)) {
      oraclePatterns.push("WARNING: Chainlink staleness check missing")
    }
  }

  if (usesUniswapTWAP) {
    oraclePatterns.push("Uniswap TWAP oracle detected")
  }

  if (usesAMM && !usesUniswapTWAP && !usesChainlink) {
    oraclePatterns.push("CRITICAL: Spot price from AMM without TWAP - flash loan attack risk")
  }

  if (usesCustomOracle) {
    oraclePatterns.push("Custom oracle implementation - requires manual review")
  }

  return {
    usesChainlink,
    usesUniswapTWAP,
    usesCustomOracle: usesCustomOracle || usesAMM,
    oraclePatterns,
  }
}
