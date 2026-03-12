import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * SOLAY39 Cross-Contract Analysis Engine
 * 
 * Analyzes interactions between multiple contracts for:
 * - Composability risks
 * - Oracle dependencies
 * - Flash loan attack vectors
 * - Governance token risks
 * - Dependency chain vulnerabilities
 * 
 * This is a key Tier 1 capability that basic audits lack.
 */

interface ContractDependency {
  address: string
  name: string
  type: "oracle" | "token" | "dex" | "lending" | "governance" | "unknown"
  critical: boolean
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  description: string
}

interface CrossContractRisk {
  id: string
  title: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  category: "flash_loan" | "oracle" | "composability" | "governance" | "dependency" | "reentrancy"
  description: string
  affectedContracts: string[]
  attackVector?: string
  mitigation: string
}

interface CrossContractReport {
  success: boolean
  mainContract: string
  dependencies: ContractDependency[]
  risks: CrossContractRisk[]
  attackSurfaces: string[]
  recommendations: string[]
}

// Chain IDs for Etherscan API v2
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  base: 8453,
  avalanche: 43114,
  optimism: 10,
}

// Fetch contract source code from Etherscan
async function fetchContractSource(address: string, network: string = "ethereum"): Promise<{ name: string; source: string; abi: string } | null> {
  const chainId = CHAIN_IDS[network.toLowerCase()] || 1
  const apiKey = process.env.ETHERSCAN_API_KEY || ""
  
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}${apiKey ? `&apikey=${apiKey}` : ""}`
    const res = await fetch(url)
    const data = await res.json()
    
    if (data.status === "1" && data.result?.[0]?.SourceCode) {
      const result = data.result[0]
      let sourceCode = result.SourceCode
      
      // Handle Solidity Standard JSON format (wrapped in {{}})
      if (sourceCode.startsWith("{{")) {
        try {
          const parsed = JSON.parse(sourceCode.slice(1, -1))
          // Combine all source files
          const sources = parsed.sources || {}
          sourceCode = Object.values(sources)
            .map((s: unknown) => (s as { content?: string }).content || "")
            .join("\n\n")
        } catch {
          // Keep original if parsing fails
        }
      }
      
      return {
        name: result.ContractName || "Unknown",
        source: sourceCode,
        abi: result.ABI || "[]"
      }
    }
    return null
  } catch {
    return null
  }
}

// Extract imported contract addresses from source code
function extractDependencyAddresses(code: string): string[] {
  const addresses: string[] = []
  
  // Match hardcoded addresses
  const addressMatches = code.matchAll(/(?:address|constant|immutable)[^=]*=\s*(0x[a-fA-F0-9]{40})/gi)
  for (const match of addressMatches) {
    if (!addresses.includes(match[1].toLowerCase())) {
      addresses.push(match[1].toLowerCase())
    }
  }
  
  // Match addresses in constructor or initializer
  const constructorAddresses = code.matchAll(/(?:constructor|initialize)\s*\([^)]*\)\s*[^{]*\{[^}]*?(0x[a-fA-F0-9]{40})/gi)
  for (const match of constructorAddresses) {
    if (!addresses.includes(match[1].toLowerCase())) {
      addresses.push(match[1].toLowerCase())
    }
  }
  
  return addresses
}

// Known DeFi protocols and their risk profiles
const KNOWN_PROTOCOLS: Record<string, { name: string; type: ContractDependency["type"]; risk: ContractDependency["risk"] }> = {
  // Oracles
  "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419": { name: "Chainlink ETH/USD", type: "oracle", risk: "LOW" },
  "0x986b5e1e1755e3c2440e960477f25201b0a8bbd4": { name: "Chainlink WBTC/USD", type: "oracle", risk: "LOW" },
  // DEXs
  "0x7a250d5630b4cf539739df2c5dacab4c659f2488": { name: "Uniswap V2 Router", type: "dex", risk: "LOW" },
  "0xe592427a0aece92de3edee1f18e0157c05861564": { name: "Uniswap V3 Router", type: "dex", risk: "LOW" },
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": { name: "PancakeSwap Router", type: "dex", risk: "LOW" },
  // Lending
  "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": { name: "Aave V2 Pool", type: "lending", risk: "LOW" },
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": { name: "Aave V3 Pool", type: "lending", risk: "LOW" },
  "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b": { name: "Compound Comptroller", type: "lending", risk: "LOW" },
}

// Extract external calls from Solidity code
function extractExternalCalls(code: string): Array<{ target: string; method: string; line: number }> {
  const calls: Array<{ target: string; method: string; line: number }> = []
  const lines = code.split("\n")
  
  lines.forEach((line, idx) => {
    // Interface calls: IProtocol(address).method()
    const interfaceMatch = line.match(/I(\w+)\s*\(\s*(0x[a-fA-F0-9]{40}|[\w.]+)\s*\)\.(\w+)\s*\(/)
    if (interfaceMatch) {
      calls.push({
        target: interfaceMatch[2],
        method: interfaceMatch[3],
        line: idx + 1
      })
    }
    
    // Direct calls: address.call() or contract.method()
    const callMatch = line.match(/(\w+)\.(\w+)\s*\(/)
    if (callMatch && !["require", "assert", "emit", "this", "super", "msg", "tx", "block"].includes(callMatch[1])) {
      calls.push({
        target: callMatch[1],
        method: callMatch[2],
        line: idx + 1
      })
    }
  })
  
  return calls
}

// Detect oracle dependencies
function detectOracleDependencies(code: string): ContractDependency[] {
  const deps: ContractDependency[] = []
  
  // Chainlink
  if (/AggregatorV3Interface|latestRoundData|priceFeed/.test(code)) {
    deps.push({
      address: "detected",
      name: "Chainlink Price Feed",
      type: "oracle",
      critical: true,
      risk: /staleness|timestamp|roundId/.test(code) ? "LOW" : "MEDIUM",
      description: /staleness|timestamp|roundId/.test(code) 
        ? "Chainlink oracle with staleness check"
        : "Chainlink oracle WITHOUT staleness check - stale price risk"
    })
  }
  
  // TWAP oracles
  if (/TWAP|observe|consult|getQuote/.test(code) && /uniswap|sushiswap|pancake/i.test(code)) {
    deps.push({
      address: "detected",
      name: "TWAP Oracle",
      type: "oracle",
      critical: true,
      risk: "MEDIUM",
      description: "Time-weighted average price oracle - may be manipulable in low liquidity conditions"
    })
  }
  
  // Spot price (dangerous)
  if (/getReserves\(\)|getAmountsOut|slot0/.test(code) && !/TWAP|twap|observe/.test(code)) {
    deps.push({
      address: "detected",
      name: "DEX Spot Price",
      type: "oracle",
      critical: true,
      risk: "CRITICAL",
      description: "Uses DEX spot price as oracle - HIGHLY MANIPULABLE via flash loans"
    })
  }
  
  return deps
}

// Detect flash loan risks
function detectFlashLoanRisks(code: string): CrossContractRisk[] {
  const risks: CrossContractRisk[] = []
  
  // Flash loan callbacks
  if (/onFlashLoan|flashLoanSimple|executeOperation|uniswapV3FlashCallback|pancakeCall/.test(code)) {
    risks.push({
      id: "FL-001",
      title: "Flash Loan Callback Present",
      severity: "MEDIUM",
      category: "flash_loan",
      description: "Contract implements flash loan callback - ensure all state changes are atomic and validated",
      affectedContracts: ["main"],
      mitigation: "Verify callback cannot be called by unauthorized contracts. Check msg.sender is the expected pool."
    })
  }
  
  // Spot price + state change (classic attack vector)
  if (/getReserves|getAmountsOut|slot0/.test(code) && /balanceOf|transfer|mint|burn/.test(code)) {
    risks.push({
      id: "FL-002",
      title: "Flash Loan Price Manipulation Vector",
      severity: "CRITICAL",
      category: "flash_loan",
      description: "Contract reads spot price and performs token operations - classic flash loan attack vector",
      affectedContracts: ["main", "price_source"],
      attackVector: "1. Take flash loan\n2. Manipulate pool reserves\n3. Trigger contract action at manipulated price\n4. Repay loan with profit",
      mitigation: "Use TWAP or Chainlink oracles. Add flash loan guard modifier."
    })
  }
  
  // Balance checks without reentrancy guard
  if (/balanceOf.*before|before.*balanceOf/.test(code) && !/ReentrancyGuard|nonReentrant/.test(code)) {
    risks.push({
      id: "FL-003",
      title: "Balance Check Without Reentrancy Guard",
      severity: "HIGH",
      category: "flash_loan",
      description: "Contract checks balance before/after but lacks reentrancy protection",
      affectedContracts: ["main"],
      mitigation: "Add ReentrancyGuard from OpenZeppelin"
    })
  }
  
  return risks
}

// Detect governance risks
function detectGovernanceRisks(code: string): CrossContractRisk[] {
  const risks: CrossContractRisk[] = []
  
  // Voting with transferable tokens
  if (/votingPower|getVotes|getPastVotes/.test(code) && /transfer|transferFrom/.test(code)) {
    if (!/snapshot|_checkpoints|Checkpoint/.test(code)) {
      risks.push({
        id: "GOV-001",
        title: "Flash Loan Governance Attack Vector",
        severity: "CRITICAL",
        category: "governance",
        description: "Governance uses current balance for voting without snapshots - flash loan attack possible",
        affectedContracts: ["main", "governance"],
        attackVector: "1. Flash loan governance tokens\n2. Create proposal or vote\n3. Return tokens\n4. Execute malicious proposal",
        mitigation: "Use ERC20Votes with checkpoints. Require tokens to be held for minimum period before voting."
      })
    }
  }
  
  // Timelock bypass
  if (/timelock|TimelockController/.test(code)) {
    if (/emergency|bypass|skip|immediate/.test(code)) {
      risks.push({
        id: "GOV-002",
        title: "Timelock Emergency Bypass",
        severity: "HIGH",
        category: "governance",
        description: "Timelock has emergency bypass mechanism - reduces security guarantees",
        affectedContracts: ["main", "timelock"],
        mitigation: "Document emergency conditions clearly. Require multi-sig for bypasses."
      })
    }
  }
  
  return risks
}

// Detect composability risks
function detectComposabilityRisks(code: string): CrossContractRisk[] {
  const risks: CrossContractRisk[] = []
  
  // Approve/transfer pattern without checks
  if (/approve.*type\(uint256\)\.max|approve.*uint256\(-1\)/.test(code)) {
    risks.push({
      id: "COMP-001",
      title: "Infinite Approval",
      severity: "MEDIUM",
      category: "composability",
      description: "Contract uses infinite approvals - if approved contract is compromised, all approved tokens at risk",
      affectedContracts: ["main"],
      mitigation: "Use exact amount approvals or implement approval reset after operations"
    })
  }
  
  // Callback patterns
  if (/callback|onReceived|onTransfer|tokensReceived/.test(code)) {
    risks.push({
      id: "COMP-002",
      title: "External Callback Pattern",
      severity: "LOW",
      category: "composability",
      description: "Contract implements token callbacks - potential reentrancy vector",
      affectedContracts: ["main"],
      mitigation: "Ensure callbacks cannot manipulate state unexpectedly. Use ReentrancyGuard."
    })
  }
  
  // Multiple external calls
  const externalCalls = (code.match(/\.call\{|\.delegatecall|\.staticcall|I\w+\([^)]+\)\.\w+\(/g) || []).length
  if (externalCalls > 5) {
    risks.push({
      id: "COMP-003",
      title: "High External Call Density",
      severity: "MEDIUM",
      category: "composability",
      description: `Contract makes ${externalCalls} external calls - complex interaction surface increases attack vectors`,
      affectedContracts: ["main"],
      mitigation: "Review each external call for trust assumptions. Consider batching or simplifying."
    })
  }
  
  return risks
}

// Main analysis function
function analyzeCrossContract(code: string, contractName: string): CrossContractReport {
  const dependencies: ContractDependency[] = []
  const risks: CrossContractRisk[] = []
  const attackSurfaces: string[] = []
  const recommendations: string[] = []
  
  // Detect dependencies
  dependencies.push(...detectOracleDependencies(code))
  
  // Extract external calls
  const calls = extractExternalCalls(code)
  if (calls.length > 0) {
    attackSurfaces.push(`${calls.length} external calls detected`)
    
    // Check against known protocols
    for (const call of calls) {
      const known = KNOWN_PROTOCOLS[call.target.toLowerCase()]
      if (known) {
        dependencies.push({
          address: call.target,
          ...known,
          critical: known.type === "oracle",
          description: `${known.name} - ${call.method}() called at line ${call.line}`
        })
      }
    }
  }
  
  // Detect risks
  risks.push(...detectFlashLoanRisks(code))
  risks.push(...detectGovernanceRisks(code))
  risks.push(...detectComposabilityRisks(code))
  
  // Add dependency risks
  if (/delegatecall/.test(code)) {
    risks.push({
      id: "DEP-001",
      title: "Delegatecall to External Contract",
      severity: "CRITICAL",
      category: "dependency",
      description: "Contract uses delegatecall - target contract can modify storage arbitrarily",
      affectedContracts: ["main", "delegate_target"],
      mitigation: "Ensure delegatecall target is immutable or behind strict access control"
    })
  }
  
  // Cross-contract reentrancy
  if (/\.call\{value:/.test(code) && /IERC20|ERC721|ERC1155/.test(code)) {
    risks.push({
      id: "REE-001",
      title: "Cross-Contract Reentrancy Vector",
      severity: "HIGH",
      category: "reentrancy",
      description: "ETH transfers combined with token operations - cross-contract reentrancy possible",
      affectedContracts: ["main", "token"],
      attackVector: "1. Call function that sends ETH\n2. Receive callback\n3. Re-enter through token transfer callback\n4. Manipulate state",
      mitigation: "Use ReentrancyGuard. Follow checks-effects-interactions pattern."
    })
  }
  
  // Generate attack surfaces
  if (dependencies.some(d => d.type === "oracle")) {
    attackSurfaces.push("Oracle manipulation via price feed attack")
  }
  if (risks.some(r => r.category === "flash_loan")) {
    attackSurfaces.push("Flash loan attack vector")
  }
  if (risks.some(r => r.category === "governance")) {
    attackSurfaces.push("Governance manipulation")
  }
  if (/delegatecall/.test(code)) {
    attackSurfaces.push("Delegatecall storage collision")
  }
  
  // Generate recommendations
  const criticals = risks.filter(r => r.severity === "CRITICAL")
  const highs = risks.filter(r => r.severity === "HIGH")
  
  if (criticals.length > 0) {
    recommendations.push(`CRITICAL: ${criticals.length} critical cross-contract risks found. Immediate action required.`)
  }
  
  if (dependencies.some(d => d.type === "oracle" && d.risk !== "LOW")) {
    recommendations.push("Implement oracle staleness checks and fallback mechanisms")
  }
  
  if (risks.some(r => r.category === "flash_loan")) {
    recommendations.push("Add flash loan guards and use TWAP/Chainlink instead of spot prices")
  }
  
  if (!code.includes("ReentrancyGuard") && risks.some(r => r.category === "reentrancy")) {
    recommendations.push("Implement OpenZeppelin ReentrancyGuard on all external-facing functions")
  }
  
  if (dependencies.length > 5) {
    recommendations.push("High dependency count increases attack surface - consider simplifying architecture")
  }
  
  return {
    success: true,
    mainContract: contractName,
    dependencies,
    risks,
    attackSurfaces,
    recommendations
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, contractName = "Contract", contractAddress, network = "ethereum", fetchDependencies = true } = await req.json()
    
    if (!code) {
      return NextResponse.json({ error: "Missing 'code' parameter" }, { status: 400 })
    }
    
    const report = analyzeCrossContract(code, contractName)
    
    // REAL ON-CHAIN: Fetch dependency contracts from Etherscan
    if (fetchDependencies && contractAddress) {
      // Extract addresses referenced in the code
      const dependencyAddresses = extractDependencyAddresses(code)
      
      // Add known protocol addresses found in code patterns
      const knownAddressMatches = code.matchAll(/(0x[a-fA-F0-9]{40})/gi)
      for (const match of knownAddressMatches) {
        const addr = match[1].toLowerCase()
        if (!dependencyAddresses.includes(addr)) {
          dependencyAddresses.push(addr)
        }
      }
      
      // Limit to first 10 dependencies to avoid rate limits
      const addressesToFetch = dependencyAddresses.slice(0, 10)
      
      // Fetch all dependency contracts in parallel
      const fetchPromises = addressesToFetch.map(async (addr) => {
        // Check if it's a known protocol first
        const known = KNOWN_PROTOCOLS[addr]
        if (known) {
          return {
            address: addr,
            name: known.name,
            type: known.type,
            risk: known.risk,
            critical: known.type === "oracle" || known.type === "lending",
            description: `Known protocol: ${known.name}`,
            source: null as string | null,
            fetchedFromChain: false
          }
        }
        
        // Fetch from Etherscan
        const contractData = await fetchContractSource(addr, network)
        if (contractData) {
          return {
            address: addr,
            name: contractData.name,
            type: "unknown" as const,
            risk: "MEDIUM" as const,
            critical: false,
            description: `External dependency: ${contractData.name}`,
            source: contractData.source,
            fetchedFromChain: true
          }
        }
        
        return {
          address: addr,
          name: "Unverified Contract",
          type: "unknown" as const,
          risk: "HIGH" as const,
          critical: true,
          description: "Contract source not verified on Etherscan - CANNOT AUDIT",
          source: null,
          fetchedFromChain: false
        }
      })
      
      const fetchedDeps = await Promise.all(fetchPromises)
      
      // Analyze fetched dependencies
      for (const dep of fetchedDeps) {
        report.dependencies.push({
          address: dep.address,
          name: dep.name,
          type: dep.type,
          critical: dep.critical,
          risk: dep.risk,
          description: dep.description
        })
        
        // If we got source code, analyze it too
        if (dep.source && dep.fetchedFromChain) {
          const depReport = analyzeCrossContract(dep.source, dep.name)
          
          // Merge critical risks from dependencies
          for (const risk of depReport.risks) {
            if (risk.severity === "CRITICAL" || risk.severity === "HIGH") {
              report.risks.push({
                ...risk,
                id: `DEP-${dep.name}-${risk.id}`,
                title: `[${dep.name}] ${risk.title}`,
                affectedContracts: [dep.name, contractName, ...risk.affectedContracts]
              })
            }
          }
          
          // Check for vulnerable dependency versions
          if (/openzeppelin.*3\.[0-3]|openzeppelin.*2\./.test(dep.source.toLowerCase())) {
            report.risks.push({
              id: `DEP-${dep.name}-VER`,
              title: `[${dep.name}] Outdated OpenZeppelin Version`,
              severity: "HIGH",
              category: "dependency",
              description: `Dependency ${dep.name} uses outdated OpenZeppelin contracts with known vulnerabilities`,
              affectedContracts: [dep.name, contractName],
              mitigation: "Update dependency to latest OpenZeppelin version (5.x)"
            })
          }
        }
        
        // Flag unverified contracts as high risk
        if (!dep.source && dep.risk === "HIGH") {
          report.risks.push({
            id: `DEP-${dep.address.slice(0, 10)}-UNVERIFIED`,
            title: "Unverified Dependency Contract",
            severity: "HIGH",
            category: "dependency",
            description: `Contract at ${dep.address} is not verified on Etherscan - source code cannot be audited`,
            affectedContracts: [dep.address, contractName],
            mitigation: "Request contract verification or replace with verified alternative"
          })
        }
      }
      
      // Add metadata about on-chain analysis
      report.attackSurfaces.push(`${fetchedDeps.filter(d => d.fetchedFromChain).length} dependency contracts fetched from ${network}`)
      report.attackSurfaces.push(`${fetchedDeps.filter(d => !d.source).length} unverified contracts detected`)
    }
    
    return NextResponse.json({
      ...report,
      analysisMode: fetchDependencies && contractAddress ? "on-chain-real" : "static-only",
      network: network,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: "Analysis failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: "SOLAY39 Cross-Contract Analysis Engine",
    version: "1.0.0",
    capabilities: [
      "Oracle dependency detection (Chainlink, TWAP, spot price)",
      "Flash loan attack vector identification",
      "Governance manipulation risks",
      "Composability analysis",
      "Delegatecall storage collision detection",
      "Cross-contract reentrancy patterns",
      "Known protocol identification"
    ],
    riskCategories: ["flash_loan", "oracle", "composability", "governance", "dependency", "reentrancy"],
    knownProtocols: Object.keys(KNOWN_PROTOCOLS).length,
    usage: {
      single: "POST /api/cross-contract { code, contractName }",
      multi: "POST /api/cross-contract { code, contractName, relatedContracts: [{ code, name }] }"
    }
  })
}
