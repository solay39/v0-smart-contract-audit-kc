/**
 * Economic Attack Analyzer - Detects DeFi-specific economic vulnerabilities
 * Flash loans, MEV, sandwich attacks, oracle manipulation, liquidation risks
 */

export interface EconomicVulnerability {
  type: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  attackVector: string
  estimatedImpact: string
  profitability: "high" | "medium" | "low" | "unknown"
  prerequisites: string[]
  mitigation: string
  lineNumbers?: number[]
}

export interface EconomicAnalysisResult {
  vulnerabilities: EconomicVulnerability[]
  defiPatterns: string[]
  tokenomicsRisks: string[]
  mevExposure: "high" | "medium" | "low" | "none"
  flashLoanRisk: "high" | "medium" | "low" | "none"
  summary: {
    criticalCount: number
    highCount: number
    mediumCount: number
    lowCount: number
    totalRisk: string
  }
}

// Analyze contract for economic attack vectors
export function analyzeEconomicAttacks(code: string): EconomicAnalysisResult {
  const vulnerabilities: EconomicVulnerability[] = []
  const defiPatterns: string[] = []
  const tokenomicsRisks: string[] = []
  const lines = code.split("\n")

  // Detect DeFi patterns
  const isLending = /borrow|repay|liquidate|collateral|debtToken|aToken/.test(code)
  const isAMM = /swap|addLiquidity|removeLiquidity|getReserves|mint.*liquidity/.test(code)
  const isYield = /harvest|compound|stake|unstake|reward|yield/.test(code)
  const isVault = /deposit|withdraw|shares|totalAssets|ERC4626/.test(code)
  const hasFlashLoan = /flashLoan|flashSwap|FLASHLOAN|onFlashLoan|executeOperation/.test(code)

  if (isLending) defiPatterns.push("Lending/Borrowing Protocol")
  if (isAMM) defiPatterns.push("AMM/DEX")
  if (isYield) defiPatterns.push("Yield Farming/Staking")
  if (isVault) defiPatterns.push("Vault/Asset Management")
  if (hasFlashLoan) defiPatterns.push("Flash Loan Integration")

  // 1. Flash Loan Attack Vectors
  const spotPriceRead = /getReserves\(\)|reserve0|reserve1|balanceOf.*\).*\//.test(code)
  const noTWAP = !/TWAP|twap|TimeWeighted|observe\(|consult\(/.test(code)
  
  if (spotPriceRead && noTWAP) {
    vulnerabilities.push({
      type: "FLASH_LOAN_PRICE_MANIPULATION",
      severity: "CRITICAL",
      attackVector: "Attacker borrows large amount via flash loan, manipulates AMM reserves, triggers protocol action at manipulated price, repays flash loan in same tx",
      estimatedImpact: "100% of protocol TVL at risk",
      profitability: "high",
      prerequisites: ["Flash loan provider available", "Sufficient liquidity to manipulate"],
      mitigation: "Use TWAP oracle with minimum 30-minute window, or Chainlink price feeds",
    })
  }

  // 2. Sandwich Attack Exposure
  const hasSwap = /swap|Swap|exchange/.test(code)
  const noSlippageCheck = !/minAmount|amountOutMin|slippage|deadline/.test(code)
  
  if (hasSwap && noSlippageCheck) {
    vulnerabilities.push({
      type: "SANDWICH_ATTACK",
      severity: "HIGH",
      attackVector: "Attacker front-runs victim tx with large buy, victim tx executes at worse price, attacker back-runs with sell",
      estimatedImpact: "1-5% per transaction, accumulates with volume",
      profitability: "high",
      prerequisites: ["Victim tx in public mempool", "MEV bot infrastructure"],
      mitigation: "Implement slippage protection (minAmountOut) and transaction deadline",
    })
  }

  // 3. Liquidation MEV
  if (isLending) {
    const hasPublicLiquidate = /function\s+liquidate.*public|external/.test(code)
    
    if (hasPublicLiquidate) {
      vulnerabilities.push({
        type: "LIQUIDATION_MEV",
        severity: "MEDIUM",
        attackVector: "MEV bots compete to liquidate undercollateralized positions, extracting value from the protocol and borrowers",
        estimatedImpact: "Liquidation bonus goes to MEV bots instead of protocol/users",
        profitability: "medium",
        prerequisites: ["Positions becoming undercollateralized", "MEV infrastructure"],
        mitigation: "Consider Dutch auction liquidations, private mempool (Flashbots), or gradual liquidation",
      })
    }
  }

  // 4. ERC4626 Vault Inflation Attack
  if (isVault) {
    const hasShareMath = /shares\s*=.*totalSupply|convertToShares|previewDeposit/.test(code)
    const noMinDeposit = !/MINIMUM_LIQUIDITY|deadShares|minDeposit/.test(code)
    
    if (hasShareMath && noMinDeposit) {
      vulnerabilities.push({
        type: "VAULT_INFLATION_ATTACK",
        severity: "HIGH",
        attackVector: "First depositor deposits 1 wei, donates large amount directly to vault, subsequent depositors receive 0 shares due to rounding",
        estimatedImpact: "100% of first depositors' funds stolen",
        profitability: "high",
        prerequisites: ["Empty vault", "Ability to donate to vault address"],
        mitigation: "Mint dead shares on first deposit, use virtual offset, or implement minimum deposit",
      })
    }
  }

  // 5. Interest Rate Manipulation
  if (isLending) {
    const hasUtilization = /utilization|utilizationRate/.test(code)
    const flashManipulable = /borrow.*public|external/.test(code) && hasFlashLoan
    
    if (hasUtilization && flashManipulable) {
      vulnerabilities.push({
        type: "INTEREST_RATE_MANIPULATION",
        severity: "MEDIUM",
        attackVector: "Attacker flash borrows to spike utilization rate, affecting interest rates for other users",
        estimatedImpact: "Artificially high interest rates, unfair liquidations",
        profitability: "medium",
        prerequisites: ["Flash loan access", "Enough liquidity to move utilization"],
        mitigation: "Use time-weighted utilization rate, implement borrow caps",
      })
    }
  }

  // 6. Governance Attack
  const hasGovernance = /propose|castVote|execute.*proposal|GovernorBravo|Governor\s/.test(code)
  const noVotingDelay = !/votingDelay|VOTING_DELAY/.test(code)
  
  if (hasGovernance && noVotingDelay) {
    vulnerabilities.push({
      type: "FLASH_LOAN_GOVERNANCE",
      severity: "CRITICAL",
      attackVector: "Attacker flash loans governance tokens, creates and passes proposal in same block, executes malicious upgrade",
      estimatedImpact: "Complete protocol takeover - Beanstalk style ($182M)",
      profitability: "high",
      prerequisites: ["Governance token available for flash loan", "No voting delay"],
      mitigation: "Implement voting delay (min 1 block), require tokens locked before voting",
    })
  }

  // 7. Oracle Manipulation via Donation
  const readsTotalBalance = /address\(this\)\.balance|balanceOf\(address\(this\)\)/.test(code)
  const usesAsPrice = readsTotalBalance && /getPrice|getValue|totalValue/.test(code)
  
  if (usesAsPrice) {
    vulnerabilities.push({
      type: "DONATION_ATTACK",
      severity: "HIGH",
      attackVector: "Attacker donates tokens directly to contract, inflating balance-based valuations",
      estimatedImpact: "Manipulated pricing, unfair liquidations, inflated collateral",
      profitability: "medium",
      prerequisites: ["Contract uses balance as price input"],
      mitigation: "Track deposited amounts separately from balance, use internal accounting",
    })
  }

  // 8. Reentrancy in DeFi Context
  const hasReentryRisk = /\.call\{value:.*\(|transfer\(|\.call\(/.test(code)
  const stateAfterCall = /\.call.*\n.*=\s*[^=]|transfer.*\n.*balances\[/.test(code)
  
  if (hasReentryRisk && stateAfterCall && !code.includes("ReentrancyGuard")) {
    vulnerabilities.push({
      type: "DEFI_REENTRANCY",
      severity: "CRITICAL",
      attackVector: "Attacker reenters during ETH transfer callback, draining funds before state update",
      estimatedImpact: "100% of contract ETH drained",
      profitability: "high",
      prerequisites: ["External call before state update", "Attacker controls callback"],
      mitigation: "Use ReentrancyGuard, follow CEI pattern, use pull payments",
    })
  }

  // 9. Token Approval Abuse
  const infiniteApproval = /approve\(.*type\(uint256\)\.max|approve\(.*\-1|MAX_UINT/.test(code)
  
  if (infiniteApproval) {
    vulnerabilities.push({
      type: "INFINITE_APPROVAL_RISK",
      severity: "LOW",
      attackVector: "If contract is compromised, attacker can drain all approved tokens from users",
      estimatedImpact: "All tokens ever approved by users",
      profitability: "high",
      prerequisites: ["Contract compromise", "User gave infinite approval"],
      mitigation: "Request exact approval amounts, implement approval reset on interaction",
    })
  }

  // 10. Reward Manipulation in Staking
  if (isYield) {
    const rewardPerToken = /rewardPerToken|rewardRate.*totalSupply/.test(code)
    const flashStakable = /stake.*public|external/.test(code)
    
    if (rewardPerToken && flashStakable) {
      vulnerabilities.push({
        type: "REWARD_MANIPULATION",
        severity: "MEDIUM",
        attackVector: "Attacker flash stakes large amount right before reward distribution, claims disproportionate rewards",
        estimatedImpact: "Diluted rewards for legitimate stakers",
        profitability: "medium",
        prerequisites: ["Stakeable token available for flash loan", "No staking lockup"],
        mitigation: "Implement minimum staking duration, checkpoint rewards before deposits",
      })
    }
  }

  // Tokenomics risks
  const hasMint = /function\s+mint.*public|external/.test(code)
  const hasUnlimitedMint = hasMint && !/maxSupply|cap|MAX_SUPPLY/.test(code)
  if (hasUnlimitedMint) {
    tokenomicsRisks.push("Unlimited mint capability - supply inflation risk")
  }

  const hasFeeOnTransfer = /fee|Fee|tax|Tax/.test(code) && /transfer/.test(code)
  if (hasFeeOnTransfer) {
    tokenomicsRisks.push("Fee-on-transfer token - may break DeFi integrations")
  }

  const hasBlacklist = /blacklist|Blacklist|blocked|frozen/.test(code)
  if (hasBlacklist) {
    tokenomicsRisks.push("Blacklist functionality - centralization risk")
  }

  // Calculate summary
  const criticalCount = vulnerabilities.filter(v => v.severity === "CRITICAL").length
  const highCount = vulnerabilities.filter(v => v.severity === "HIGH").length
  const mediumCount = vulnerabilities.filter(v => v.severity === "MEDIUM").length
  const lowCount = vulnerabilities.filter(v => v.severity === "LOW").length

  const mevExposure: EconomicAnalysisResult["mevExposure"] = 
    vulnerabilities.some(v => ["SANDWICH_ATTACK", "LIQUIDATION_MEV"].includes(v.type)) ? "high" :
    hasSwap ? "medium" : "low"

  const flashLoanRisk: EconomicAnalysisResult["flashLoanRisk"] =
    vulnerabilities.some(v => v.type.includes("FLASH")) ? "high" :
    hasFlashLoan ? "medium" : spotPriceRead && noTWAP ? "high" : "low"

  const totalRisk = criticalCount > 0 ? "CRITICAL" :
                   highCount > 0 ? "HIGH" :
                   mediumCount > 0 ? "MEDIUM" : "LOW"

  return {
    vulnerabilities,
    defiPatterns,
    tokenomicsRisks,
    mevExposure,
    flashLoanRisk,
    summary: {
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      totalRisk,
    },
  }
}

// Generate attack simulation scenarios
export function generateAttackScenarios(vulns: EconomicVulnerability[]): string[] {
  const scenarios: string[] = []

  for (const vuln of vulns) {
    switch (vuln.type) {
      case "FLASH_LOAN_PRICE_MANIPULATION":
        scenarios.push(`
// Flash Loan Attack Scenario
1. Attacker borrows 10,000 ETH from Aave
2. Dumps ETH into Uniswap pool, crashing price
3. Calls vulnerable protocol at manipulated price
4. Protocol values attacker's collateral incorrectly
5. Attacker borrows maximum against inflated collateral
6. Repays flash loan
7. Profit: Borrowed funds minus flash loan fee
`)
        break

      case "VAULT_INFLATION_ATTACK":
        scenarios.push(`
// ERC4626 Inflation Attack
1. Attacker is first depositor, deposits 1 wei
2. Attacker receives 1 share
3. Attacker donates 10 ETH directly to vault (no deposit)
4. totalAssets = 10 ETH + 1 wei, totalShares = 1
5. Victim deposits 9.9 ETH
6. shares = 9.9e18 * 1 / 10e18 = 0 (rounds down)
7. Victim receives 0 shares, loses 9.9 ETH
8. Attacker withdraws all with their 1 share
`)
        break

      case "FLASH_LOAN_GOVERNANCE":
        scenarios.push(`
// Beanstalk-style Governance Attack
1. Attacker flash loans governance token
2. Deposits tokens, gets voting power
3. Creates malicious proposal (drain treasury)
4. Votes with flash loaned power (passes instantly)
5. Executes proposal
6. Treasury drained to attacker
7. Repays flash loan
8. Total time: 1 block (~12 seconds)
`)
        break

      case "SANDWICH_ATTACK":
        scenarios.push(`
// Sandwich Attack (MEV)
1. Victim submits swap: ETH -> TOKEN
2. Attacker sees tx in mempool
3. Attacker front-runs: buys TOKEN (price goes up)
4. Victim tx executes at worse price
5. Attacker back-runs: sells TOKEN (price drops)
6. Profit: difference minus gas
7. Per-tx profit: 0.5-5% of victim trade size
`)
        break
    }
  }

  return scenarios
}
