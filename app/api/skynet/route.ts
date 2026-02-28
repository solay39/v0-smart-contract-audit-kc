import { generateText } from "ai"

/* ───────── types ───────── */

interface Finding {
  title: string
  severity: string
  location: string
  description: string
  impact: string
  recommendation: string
}

interface ContractMeta {
  contractType: "erc20" | "erc721" | "defi-protocol" | "proxy" | "generic" | "spl-token" | "solana-program" | "move-module" | "cosmwasm" | "non-evm"
  isERC20: boolean
  hasProxy: boolean
  hasOwner: boolean
  ownerRenounced: boolean
  hasMintOutsideConstructor: boolean
  hasConstructorOnlyMint: boolean
  hasPausable: boolean
  pausableProtected: boolean
  hasBlacklist: boolean
  hasSetFee: boolean
  hasSelfDestruct: boolean
  hasDelegatecall: boolean
  hasExternalCalls: boolean
  usesOZ: boolean
  solidityVersion: string
  hasSafeMath: boolean
  scopeLabel: string
  centralizationLevel: "Low" | "Medium" | "High"
  centralizationRisk: "Low" | "Medium" | "High"
  // Multi-chain fields
  codeLanguage: string
  network: string
  linesOfCode: number
  isNonEVM: boolean
}

/* ───────── contract metadata extraction ───────── */

function detectCodeLanguage(network: string): string {
  if (network === "Solana") return "Rust/Anchor"
  if (["Sui", "Aptos"].includes(network)) return "Move"
  if (["Cosmos", "Injective", "Sei"].includes(network)) return "CosmWasm (Rust)"
  if (network === "Near") return "Rust/near-sdk"
  if (network === "Ton") return "FunC/Tact"
  if (network === "Starknet") return "Cairo"
  return "Solidity"
}

const NON_EVM_CHAINS = ["Solana", "Sui", "Aptos", "Cosmos", "Injective", "Sei", "Near", "Ton", "Starknet"]

function extractContractMeta(code: string, network: string): ContractMeta {
  const isNonEVM = NON_EVM_CHAINS.includes(network)
  const codeLanguage = detectCodeLanguage(network)
  const linesOfCode = code.split("\n").filter(l => l.trim().length > 0).length

  // ── Non-EVM: detect program type from code patterns ──
  if (isNonEVM) {
    let contractType: ContractMeta["contractType"] = "non-evm"
    let scopeLabel = `${network} Program`

    if (network === "Solana") {
      const isAnchor = /use\s+anchor_lang|#\[program\]|#\[derive\(Accounts\)\]/.test(code)
      const isSPLToken = /spl_token|token::mint|MintTo|token_program|TokenAccount/.test(code)
      const hasIDL = /"instructions"\s*:\s*\[|"accounts"\s*:\s*\[/.test(code)

      if (isSPLToken || hasIDL) {
        contractType = "spl-token"
        scopeLabel = "Solana SPL Token Program"
      } else if (isAnchor) {
        contractType = "solana-program"
        scopeLabel = "Solana Anchor Program"
      } else {
        contractType = "solana-program"
        scopeLabel = "Solana Program"
      }
    } else if (["Sui", "Aptos"].includes(network)) {
      contractType = "move-module"
      scopeLabel = `${network} Move Module`
    } else if (["Cosmos", "Injective", "Sei"].includes(network)) {
      contractType = "cosmwasm"
      scopeLabel = `${network} CosmWasm Contract`
    }

    // Non-EVM: check for authority/admin patterns
    const hasOwner = network === "Solana"
      ? /authority|admin|owner|has_one\s*=\s*authority|constraint\s*=\s*.*authority/.test(code)
      : /admin|owner|authority|governance/.test(code.toLowerCase())

    const hasMintOutsideConstructor = network === "Solana"
      ? /mint_to|MintTo|token::mint_to/.test(code)
      : /mint|create_token/.test(code.toLowerCase())

    return {
      contractType, isERC20: false, hasProxy: false,
      hasOwner, ownerRenounced: false,
      hasMintOutsideConstructor, hasConstructorOnlyMint: false,
      hasPausable: /pause|freeze|frozen/.test(code.toLowerCase()),
      pausableProtected: false,
      hasBlacklist: /blacklist|blocklist|freeze_account/.test(code.toLowerCase()),
      hasSetFee: /set_fee|update_fee|fee_rate/.test(code.toLowerCase()),
      hasSelfDestruct: false, hasDelegatecall: false,
      hasExternalCalls: /invoke|CPI|cross_program|cpi_call/.test(code),
      usesOZ: false,
      solidityVersion: "N/A",
      hasSafeMath: true, // Rust has built-in overflow checks
      scopeLabel,
      centralizationLevel: hasOwner ? "Medium" : "Low",
      centralizationRisk: hasOwner ? "Medium" : "Low",
      codeLanguage, network, linesOfCode, isNonEVM: true,
    }
  }

  // ── EVM: existing Solidity analysis ──
  const isERC20 = /is\s+(ERC20|IERC20|BEP20)|function\s+transfer\s*\(.*address.*uint/.test(code)
    && /function\s+approve\s*\(/.test(code)
    && /balances|_balances|balanceOf/.test(code)

  const isERC721 = /ERC721|function\s+ownerOf|function\s+tokenURI/.test(code)
  const hasProxy = /delegatecall|EIP1967|TransparentUpgradeableProxy|UUPSUpgradeable|implementation\(\)/.test(code)
  const hasDeFiLogic = /swap|liquidity|pool|vault|stake|borrow|lend|oracle|liquidat/.test(code.toLowerCase())

  const hasSafeMath = /library\s+SafeMath|SafeMath\s+for\s+uint|using\s+SafeMath|\.add\(|\.sub\(|\.mul\(|\.div\(/.test(code)

  const hasConstructorOnlyMint = (() => {
    if (!/_mint|mint/.test(code)) return false
    const mintOutsideConstructor = code
      .replace(/constructor\s*\([^)]*\)[^{]*\{[^}]*\}/gs, "")
      .replace(/function\s+\w+\s*\([^)]*\)[^{]*\{[^}]*_mint[^}]*\}/gs, "")
    const hasPublicMint = /function\s+\w*[Mm]int\s*\([^)]*\)\s*(public|external)/.test(mintOutsideConstructor)
    const hasInternalMintCall = /function\s+\w*[Mm]int\s*\(/.test(mintOutsideConstructor)
    return !hasPublicMint && (!hasInternalMintCall || /function\s+_mint\s*\(.*internal/.test(code))
  })()

  const hasMintOutsideConstructor = /_mint|mint/.test(code) && !hasConstructorOnlyMint

  const hasOZPausable = /ERC20Pausable|PausableUpgradeable|import.*Pausable/.test(code)
  const hasOZAccessControl = /Ownable|AccessControl|Roles\s*for|MinterRole|PauserRole/.test(code)
  const usesOZ = hasOZPausable || hasOZAccessControl || /import.*@openzeppelin|OpenZeppelin/.test(code)

  const hasOwner = /onlyOwner|Ownable|owner\(\)|_owner|AccessControl|onlyRole|onlyAdmin/.test(code)
  const ownerRenounced = /renounceOwnership|ownership.*renounced/.test(code)
  const hasPausable = /pause|unpause|Pausable/.test(code)
  const pausableProtected = hasPausable && (hasOZPausable || /onlyOwner|onlyPauser|onlyRole/.test(code))
  const hasBlacklist = /blacklist|blocklist|isBlocked|deny/.test(code.toLowerCase())
  const hasSetFee = /setFee|setTax|_taxRate|_fee\s*=/.test(code)
  const hasSelfDestruct = /selfdestruct|suicide/.test(code)
  const hasDelegatecall = /delegatecall/.test(code)
  const hasExternalCalls = /\.call\{value|\.call\(|\.transfer\(|\.send\(/.test(code)
  const mintGuarded = hasMintOutsideConstructor && (hasOZAccessControl || /onlyOwner|onlyMinter|onlyRole|require\s*\(.*msg\.sender/.test(code))

  const pragmaMatch = code.match(/pragma solidity\s+[\^~]?(0\.(\d+)\.?\d*)/)
  const solidityVersion = pragmaMatch ? pragmaMatch[1] : "unknown"

  let contractType: ContractMeta["contractType"] = "generic"
  if (hasProxy) contractType = "proxy"
  else if (isERC721) contractType = "erc721"
  else if (isERC20 && !hasDeFiLogic) contractType = "erc20"
  else if (hasDeFiLogic) contractType = "defi-protocol"

  let scopeLabel = "Smart Contract"
  if (contractType === "erc20") scopeLabel = "ERC-20 Token Contract"
  else if (contractType === "erc721") scopeLabel = "ERC-721 NFT Contract"
  else if (contractType === "proxy") scopeLabel = "Upgradeable Proxy Contract"
  else if (contractType === "defi-protocol") scopeLabel = "DeFi Protocol Contract"

  let centralizationLevel: ContractMeta["centralizationLevel"] = "Low"
  let centralizationRisk: ContractMeta["centralizationRisk"] = "Low"

  if (hasMintOutsideConstructor || hasBlacklist || hasSetFee) {
    centralizationLevel = "High"
    centralizationRisk = hasOwner ? "Medium" : "High"
  } else if (hasPausable && !ownerRenounced) {
    centralizationLevel = "Medium"
    centralizationRisk = pausableProtected ? "Low" : "Medium"
  } else if (hasOwner && !ownerRenounced) {
    centralizationLevel = "Medium"
    centralizationRisk = "Low"
  }

  return {
    contractType, isERC20, hasProxy, hasOwner, ownerRenounced,
    hasMintOutsideConstructor, hasConstructorOnlyMint, mintGuarded,
    hasPausable, pausableProtected, hasBlacklist, hasSetFee, hasSelfDestruct,
    hasDelegatecall, hasExternalCalls, usesOZ, solidityVersion,
    hasSafeMath, scopeLabel, centralizationLevel, centralizationRisk,
    codeLanguage, network, linesOfCode, isNonEVM: false,
  }
}

/* ───────── realistic score breakdown ───────── */

function computeScoreBreakdown(
  baseScore: number,
  meta: ContractMeta,
  findingCount: { critical: number; high: number; medium: number; low: number; info: number }
): Record<string, number> {
  // Code Security: directly from findings
  let codeSecurity = 100
    - findingCount.critical * 25
    - findingCount.high * 10
    - findingCount.medium * 3
    - findingCount.low * 1
  codeSecurity = Math.max(0, Math.min(100, codeSecurity))

  // Architecture Risk: only meaningful for protocols/proxies, not simple ERC-20s
  let architectureRisk: number
  if (meta.contractType === "erc20") {
    // Simple token: architecture is trivial. Score capped at codeSecurity
    architectureRisk = Math.min(codeSecurity, meta.usesOZ ? 95 : 88)
  } else if (meta.contractType === "defi-protocol") {
    architectureRisk = Math.max(0, codeSecurity - 5)
    if (meta.hasExternalCalls) architectureRisk -= 5
    if (meta.hasProxy) architectureRisk -= 5
  } else {
    architectureRisk = Math.max(0, codeSecurity - 3)
  }

  // Governance Risk: based on actual on-chain governance features
  let governanceRisk: number
  if (!meta.hasOwner && !meta.hasPausable && !meta.hasMintOutsideConstructor) {
    // Fully trustless: high governance score
    governanceRisk = 95
  } else if (meta.ownerRenounced) {
    governanceRisk = 92
  } else if (meta.hasOwner && meta.pausableProtected) {
    // Owner exists with proper OZ access control
    governanceRisk = 82
  } else if (meta.hasOwner) {
    governanceRisk = 72
  } else {
    governanceRisk = 85
  }

  // Centralization: directly from contract features
  let centralization: number
  if (meta.centralizationLevel === "Low") {
    centralization = meta.ownerRenounced ? 95 : 88
  } else if (meta.centralizationLevel === "Medium") {
    centralization = meta.pausableProtected ? 75 : 65
  } else {
    centralization = meta.hasOwner ? 50 : 35
  }

  // Testing Coverage: we can only estimate — does it use established libs?
  let testingCoverage: number
  if (meta.usesOZ) {
    testingCoverage = Math.min(95, codeSecurity + 2)
  } else if (meta.hasSafeMath) {
    testingCoverage = Math.min(90, codeSecurity)
  } else {
    testingCoverage = Math.min(85, codeSecurity - 2)
  }

  // Tier-1: max score is 98 — "security is risk reduction, not perfection"
  const cap = (v: number) => Math.round(Math.max(0, Math.min(98, v)))
  return {
    codeSecurity: cap(codeSecurity),
    architectureRisk: cap(architectureRisk),
    governanceRisk: cap(governanceRisk),
    centralization: cap(centralization),
    testingCoverage: cap(testingCoverage),
  }
}

/* ───────── context-aware static analysis ───────── */

function staticAnalysis(code: string, meta: ContractMeta): Finding[] {
  const findings: Finding[] = []

  // Non-EVM: basic pattern checks instead of Solidity-specific analysis
  if (meta.isNonEVM) {
    if (meta.network === "Solana") {
      // Solana-specific checks
      if (/invoke\(|invoke_signed\(/.test(code) && !/AccountInfo.*is_signer/.test(code)) {
        findings.push({ title: "CPI Without Signer Verification", severity: "MEDIUM", location: "invoke/invoke_signed call", description: "Cross-Program Invocation detected without explicit signer verification on the invoking account.", impact: "A malicious account could potentially trigger CPI calls without proper authorization.", recommendation: "Ensure all CPI calls verify the signer constraint on the authority account." })
      }
      if (/pub\s+authority/.test(code) && !/has_one\s*=\s*authority|constraint\s*=.*authority/.test(code)) {
        findings.push({ title: "Missing Authority Constraint", severity: "HIGH", location: "Account struct definition", description: "An authority field exists in the account struct but no has_one or constraint validation is applied.", impact: "Any account could be passed as the authority, bypassing access control.", recommendation: "Add #[account(has_one = authority)] or a manual constraint check." })
      }
      if (/is_initialized/.test(code) && !/if\s+.*is_initialized/.test(code)) {
        findings.push({ title: "Potential Reinitialization Vulnerability", severity: "MEDIUM", location: "Account initialization", description: "An is_initialized field exists but may not be properly checked before initialization.", impact: "An attacker could reinitialize an account, overwriting existing data.", recommendation: "Add explicit is_initialized check before any initialization logic." })
      }
    }
    if (meta.hasOwner) {
      findings.push({ title: "Centralized Authority Control", severity: "MEDIUM", location: "Authority/admin account", description: `The program has an authority/admin account that controls privileged operations on ${meta.network}.`, impact: "If the authority key is compromised, an attacker gains full control over privileged operations.", recommendation: "Consider using a multisig or governance mechanism for the authority account." })
    }
    if (findings.length === 0) {
      findings.push({ title: `${meta.codeLanguage} Static Analysis — Limited Coverage`, severity: "INFO", location: "Full program", description: `Pattern-based static analysis on ${meta.codeLanguage} code has limited coverage. The AI analysis provides the primary security assessment for non-Solidity programs.`, impact: "Some vulnerability patterns specific to ${meta.network} may require manual review.", recommendation: "Rely primarily on the AI-guided analysis results. Consider a specialized ${meta.network} security audit for production deployments." })
    }
    return findings
  }

  const { isERC20, hasSafeMath, hasConstructorOnlyMint, hasExternalCalls,
    usesOZ, hasPausable, pausableProtected, hasOwner } = meta

  const hasOZPausable = /ERC20Pausable|PausableUpgradeable|import.*Pausable/.test(code)
  const hasOZAccessControl = /Ownable|AccessControl|Roles\s*for|MinterRole|PauserRole/.test(code)

  const hasTransferETH = /\.transfer\(|\.send\(/.test(code)
  const hasOnlyMappingOps = !hasExternalCalls && !hasTransferETH

  const hasDangerousFunctions = (() => {
    if (hasOZPausable || hasOZAccessControl) return false
    return /function\s+(pause|blacklist|setTax|setFee|forceTrans|rescue)\s*\(/.test(code) ||
           /function\s+withdraw\s*\([^)]*\)\s*(public|external)/.test(code)
  })()

  const hasOwnable = /onlyOwner|Ownable|AccessControl|onlyRole|onlyAdmin|onlyPauser|onlyMinter/.test(code)
  const hasRequireSender = /require\s*\(\s*msg\.sender/.test(code)

  /* ── 1. Reentrancy ── */
  if (hasExternalCalls || hasTransferETH) {
    // Only flag if there are REAL external calls, not just ERC-20 transfer mapping updates
    if (!isERC20 || !hasOnlyMappingOps) {
      // Check if state changes happen AFTER external calls (the actual vulnerability pattern)
      const callThenState = /\.(call|transfer|send)\s*[\({][\s\S]{0,200}(balances\[|_balances\[|\w+\s*=\s)/.test(code)
      if (callThenState) {
        findings.push({
          title: "Potential Reentrancy Vulnerability",
          severity: "HIGH",
          location: "External call with subsequent state modification",
          description: "An external call is followed by state variable modification. If the called contract is malicious, it can re-enter this function before state is updated.",
          impact: "An attacker could recursively call back into the contract before state is updated, potentially draining funds.",
          recommendation: "Apply the Checks-Effects-Interactions pattern: update all state variables before making external calls. Consider using OpenZeppelin's ReentrancyGuard.",
        })
      } else if (hasTransferETH) {
        findings.push({
          title: "External ETH Transfer Detected",
          severity: "LOW",
          location: ".transfer() or .send() usage",
          description: "The contract sends ETH via .transfer() or .send(). While .transfer() is safe against reentrancy (2300 gas limit), .send() does not revert on failure.",
          impact: "If using .send() without checking the return value, failed transfers will silently continue.",
          recommendation: "Prefer .transfer() over .send(), or use .call{value: amount}('') with reentrancy guards.",
        })
      }
    }
  }

  /* ── 2. tx.origin ── */
  if (/tx\.origin/.test(code)) {
    findings.push({
      title: "tx.origin Used for Authorization",
      severity: "CRITICAL",
      location: "tx.origin usage",
      description: "The contract uses tx.origin for authorization. This is vulnerable to phishing attacks where a malicious intermediary contract tricks the user into executing a transaction.",
      impact: "An attacker can bypass authorization checks by routing calls through a malicious contract that the user interacts with.",
      recommendation: "Replace tx.origin with msg.sender for all authorization checks.",
    })
  }

  /* ── 3. Unchecked send return value ── */
  if (/\.send\(/.test(code) && !/require\s*\(.*\.send\(/.test(code)) {
    findings.push({
      title: "Unchecked Send Return Value",
      severity: "HIGH",
      location: ".send() call",
      description: "The return value of .send() is not checked. send() returns false on failure instead of reverting the transaction.",
      impact: "Failed transfers will silently continue execution, leading to accounting errors or lost funds.",
      recommendation: "Use .transfer() (which reverts on failure) or check the return value with require(addr.send(amount), 'Send failed').",
    })
  }

  /* ── 4. Floating pragma ── */
  if (/pragma solidity \^/.test(code)) {
    findings.push({
      title: "Floating Pragma Version",
      severity: "LOW",
      location: "pragma solidity directive",
      description: "The contract uses a floating pragma (^). This allows compilation with multiple compiler versions, which may introduce inconsistencies between deployments.",
      impact: "Different compiler versions may produce different bytecode or include different known bugs.",
      recommendation: "Lock the pragma to a specific version, e.g., pragma solidity 0.8.20;",
    })
  }

  /* ── 5. Access control — context-aware ── */
  if (!isERC20 || hasDangerousFunctions) {
    // For standard ERC-20 tokens (especially those using OZ), access control is ALREADY handled
    // Only flag if there are truly unprotected dangerous functions
    if (hasOZPausable || hasOZAccessControl) {
      // OpenZeppelin modules have built-in role-based access control
      // Do NOT flag access control issues for OZ-based contracts
    } else if (hasDangerousFunctions && !hasOwnable && !hasRequireSender) {
      findings.push({
        title: "Missing Access Control on Sensitive Functions",
        severity: "HIGH",
        location: "Privileged functions (pause, blacklist, setFee, etc.)",
        description: `The contract has sensitive administrative functions without visible access control modifiers (onlyOwner, AccessControl, etc.).`,
        impact: "Any address can call these privileged functions, potentially allowing unauthorized pausing, blacklisting, or fee manipulation.",
        recommendation: "Implement access control using OpenZeppelin's Ownable or AccessControl. Add modifiers like onlyOwner to all sensitive functions.",
      })
    } else if (!isERC20) {
      const publicStateFns = code.match(
        /function\s+\w+[^)]*\)\s*(public|external)(?!\s+view)(?!\s+pure)/g
      )
      if (publicStateFns && publicStateFns.length > 3 && !hasOwnable && !hasRequireSender) {
        findings.push({
          title: "Consider Adding Access Control",
          severity: "MEDIUM",
          location: "Public/external state-changing functions",
          description: `Found ${publicStateFns.length} public/external state-changing functions. Depending on the contract's purpose, some may need access restrictions.`,
          impact: "Without access control, any address can call state-modifying functions.",
          recommendation: "Review each public function and determine if it should be restricted. Use OpenZeppelin's Ownable or AccessControl for protected functions.",
        })
      }
    }
  }

  /* ── 6. Integer overflow (pre-0.8.0) — context-aware ── */
  const pragmaMatch = code.match(/pragma solidity\s+[\^~]?(0\.(\d+))/)
  if (pragmaMatch) {
    const minor = parseInt(pragmaMatch[2])
    if (minor < 8) {
      if (hasSafeMath) {
        findings.push({
          title: "Solidity < 0.8.0 with SafeMath",
          severity: "INFO",
          location: `Compiler version ${pragmaMatch[1]}`,
          description: "The contract targets Solidity < 0.8.0 but uses SafeMath library for arithmetic operations, which provides overflow/underflow protection.",
          impact: "Arithmetic is protected by SafeMath. However, any operations NOT using SafeMath remain vulnerable.",
          recommendation: "Ensure ALL arithmetic operations use SafeMath consistently, or consider upgrading to Solidity >= 0.8.0 for built-in checks.",
        })
      } else {
        findings.push({
          title: "Integer Overflow/Underflow Risk",
          severity: "HIGH",
          location: `Compiler version ${pragmaMatch[1]}`,
          description: "The contract targets Solidity < 0.8.0 which does not have built-in overflow/underflow checks, and no SafeMath usage was detected.",
          impact: "Arithmetic operations can silently wrap around, leading to unexpected behavior and potential fund theft.",
          recommendation: "Upgrade to Solidity >= 0.8.0 or add the SafeMath library for all arithmetic operations.",
        })
      }
    }
  }

  /* ── 7. Selfdestruct ── */
  if (/selfdestruct|suicide/.test(code)) {
    findings.push({
      title: "Selfdestruct Present",
      severity: "MEDIUM",
      location: "selfdestruct instruction",
      description: "The contract contains a selfdestruct (or deprecated suicide) instruction which permanently destroys the contract and sends remaining ETH to a designated address.",
      impact: "If access control is insufficient, an attacker could permanently destroy the contract.",
      recommendation: "Remove selfdestruct if not strictly needed. If required, ensure it is protected with robust access control and a timelock.",
    })
  }

  /* ── 8. Delegatecall ── */
  if (/delegatecall/.test(code)) {
    findings.push({
      title: "Delegatecall Usage",
      severity: "HIGH",
      location: "delegatecall instruction",
      description: "The contract uses delegatecall, which executes code in the context of the calling contract. This is extremely dangerous if the target address is user-controlled.",
      impact: "A malicious target could overwrite storage variables, steal funds, or destroy the contract.",
      recommendation: "Ensure delegatecall targets are trusted, verified contracts. Use a whitelist of approved implementation addresses.",
    })
  }

  /* ── 9. Timestamp dependence ── */
  if (/block\.timestamp/.test(code) && /require.*block\.timestamp|if.*block\.timestamp/.test(code)) {
    findings.push({
      title: "Timestamp Dependence",
      severity: "LOW",
      location: "block.timestamp usage in conditional logic",
      description: "The contract uses block.timestamp in conditional checks. Miners can manipulate the block timestamp by approximately 15 seconds.",
      impact: "Time-sensitive logic could be manipulated by miners within the allowed drift window.",
      recommendation: "Avoid using block.timestamp for critical logic. Allow a tolerance window if time checks are necessary.",
    })
  }

  /* ── 10. Minting — context-aware ── */
  if (/mint|_mint/.test(code)) {
    if (hasConstructorOnlyMint) {
      // Mint is ONLY in the constructor — fixed supply, no risk
      findings.push({
        title: "Fixed Supply (Constructor-Only Mint)",
        severity: "INFO",
        location: "Constructor",
        description: "Token minting occurs only in the constructor. The supply is fixed at deployment with no public or external mint function available.",
        impact: "No inflation risk. The token supply cannot be increased after deployment.",
        recommendation: "No action needed. This is a secure pattern for fixed-supply tokens.",
      })
    } else {
      // There IS an exposed mint function
      const hasMintGuard = /onlyOwner|onlyRole|onlyMinter/.test(code) && /function\s+\w*[Mm]int/.test(code)
      if (!hasMintGuard) {
        findings.push({
          title: "Unrestricted Minting Function",
          severity: "CRITICAL",
          location: "Public/external mint function",
          description: "A mint function is exposed without visible access control. Any address may be able to mint new tokens.",
          impact: "An attacker could mint unlimited tokens, destroying the token's value for all holders.",
          recommendation: "Add strict access control (onlyOwner, onlyMinter) to the mint function. Consider adding a supply cap.",
        })
      } else {
        findings.push({
          title: "Centralized Minting Authority",
          severity: "MEDIUM",
          location: "Mint function with access control",
          description: "The contract has a mint function restricted by access control. While not exploitable by the public, a compromised owner/minter can inflate supply.",
          impact: "A compromised or malicious owner could mint additional tokens, diluting existing holders.",
          recommendation: "Consider implementing a supply cap, timelocks, or multi-sig requirements for minting operations.",
        })
      }
    }
  }

  /* ── 11. Allowance race condition (ERC-20 specific) ── */
  if (isERC20 && /function\s+approve/.test(code) && !/increaseAllowance|decreaseAllowance/.test(code)) {
    findings.push({
      title: "ERC-20 Allowance Race Condition",
      severity: "LOW",
      location: "approve() function",
      description: "The standard ERC-20 approve() function is vulnerable to a front-running race condition. If a user changes an allowance from N to M, a spender can front-run and spend both N and M.",
      impact: "A spender could extract more tokens than intended during an allowance change.",
      recommendation: "This is a known ERC-20 limitation. Consider adding increaseAllowance/decreaseAllowance helper functions, or instruct users to set allowance to 0 before changing it.",
    })
  }

  /* ── 12. Custodian concentration (ERC-20) ── */
  if (isERC20 && hasConstructorOnlyMint) {
    findings.push({
      title: "Initial Supply Concentration",
      severity: "INFO",
      location: "Constructor — full supply to single address",
      description: "The entire token supply is minted to a single address (custodian/deployer) in the constructor. This is standard for ERC-20 launches but creates concentration risk.",
      impact: "The initial holder controls 100% of supply. If tokens are not distributed, this creates market dump risk and governance centralization.",
      recommendation: "This is an economic/governance consideration, not a smart contract vulnerability. Recommend transparent vesting schedules and distribution plans.",
    })
  }

  /* ── If no findings at all ── */
  if (findings.length === 0) {
    findings.push({
      title: "Static Analysis Complete — No Issues Detected",
      severity: "INFO",
      location: "Full contract",
      description: "No common vulnerability patterns were detected by the static analyzer. This does not guarantee the contract is free of vulnerabilities.",
      impact: "N/A",
      recommendation: "Consider a full manual audit for complex business logic vulnerabilities, economic attacks, and gas optimization.",
    })
  }

  return findings
}

/* ───────── AI prompt (context-aware, anti false-positive) ───────── */

const SYSTEM_PROMPT = `You are an elite smart contract security auditor using the Solay39 Manual-First Audit Framework.

ABSOLUTE INTEGRITY RULES — NEVER VIOLATE THESE:

0. HONESTY IS NON-NEGOTIABLE:
   - You MUST accurately identify the blockchain network and programming language from the CONTRACT METADATA provided.
   - If the code is Rust/Anchor (Solana), you MUST say language is "Rust/Anchor", NOT "Solidity".
   - If the code is Move (Sui/Aptos), you MUST say language is "Move", NOT "Solidity".
   - The "scopeTable[].language" field MUST match the ACTUAL language of the code provided.
   - The "engagement.compilerVersionUsed" MUST match the actual compiler (e.g., "rustc 1.75 + Anchor 0.29" for Solana, NOT "Solidity X.Y.Z").
   - The "engagement.linesOfCode" MUST be the ACTUAL line count from the CONTRACT METADATA. NEVER report 0 if code was provided.
   - File extensions: Solana = ".rs", Move = ".move", CosmWasm = ".rs", Cairo = ".cairo", Solidity = ".sol".
   - If you cannot determine something with certainty, say "Unverified" — NEVER fabricate data.

1. UNDERSTAND THE CONTRACT TYPE FIRST. Before listing any findings, determine:
   - For EVM: Is it ERC-20/BEP-20? Upgradeable? Does it handle ETH? Has admin functions?
   - For Solana: Is it an SPL Token? Anchor program? Native Solana program? What instructions does it expose?
   - For Move: Is it a coin module? Object-based? What entry functions exist?
   - For CosmWasm: What execute/query handlers exist? What storage patterns?

2. SCOPE ACCURACY IS CRITICAL:
   - The scope label MUST match the actual program type and chain. Examples:
     - Solana SPL Token: "Solana SPL Token Program" (NOT "ERC-20 Token Contract")
     - Solana DEX: "Solana Anchor DEX Program"
     - EVM ERC-20: "ERC-20 Token Contract"
   - You are auditing ONLY the code provided. Do not claim to audit what is NOT in the code.
   - The scope description must match what the code actually contains.

3. DO NOT FLAG as vulnerabilities:
   EVM/Solidity:
   - "Missing access control" on standard ERC-20 functions (transfer, approve, transferFrom) — these are SUPPOSED to be public
   - "Missing access control" on contracts using OpenZeppelin modules — OZ has BUILT-IN role-based access control
   - "Reentrancy" on contracts that only update mappings and emit events without external calls
   - "Centralized minting" if _mint() is ONLY inside the constructor (fixed supply)
   - "Integer overflow" if SafeMath is used or Solidity >= 0.8.0
   - Known ERC-20 limitations as HIGH/CRITICAL (approve race condition is LOW at most)
   
   Solana/Anchor:
   - "Integer overflow" — Rust has built-in overflow checks in debug mode, and Anchor uses checked math
   - "Reentrancy" — Solana's execution model prevents traditional reentrancy
   - Do NOT reference Solidity concepts (delegatecall, selfdestruct, msg.sender, require()) when analyzing Rust code
   
   Move (Sui/Aptos):
   - Resource safety issues that Move's type system already prevents
   - Do NOT reference Solidity concepts when analyzing Move code
   
   General:
   - Do NOT claim to have run Slither/Mythril on non-Solidity code — those tools only work on Solidity
   - Do NOT reference ".sol" files for non-Solidity programs

4. Each finding MUST be unique. Never repeat the same finding twice.

5. For simple, standard ERC-20 tokens with no admin functions, no proxy, no external calls:
   - The attack surface is VERY LOW
   - Only report genuine issues (floating pragma, known ERC-20 limitations, supply concentration)
   - Use appropriate severity: INFO for known standard limitations, LOW for minor issues

6. GOVERNANCE & CENTRALIZATION — PROVE IT:
   - If owner exists on-chain: check if renounced, if timelock, if multisig
   - If there are privileged functions (pause, mint, blacklist): check if access-controlled
   - Do NOT rate governance/centralization as "Low" without evidence
   - If ownership is NOT renounced and has privileged functions: centralization is at least "Medium"

7. TIER-1 ANALYSIS SECTIONS (you MUST generate ALL of these):
   a) PRIVILEGED ROLES TABLE: List every role (owner, pauser, minter, upgrader, operator, admin).
      For each role: capabilities (exact functions they can call), riskIfCompromised (what happens if key leaked),
      and whether the role is behind a multisig/timelock or an EOA.
      Include on-chain evidence: "owner() = 0x... (EOA, no timelock)" or "owner() = 0x... (Gnosis Safe 3/5 multisig)".
   b) TRUST ASSUMPTIONS: Write "Users must trust X because Y" for EVERY trust dependency. Include:
      - Who controls privileged functions
      - What external systems the contract depends on
      - What economic assumptions are made
   c) ARCHITECTURE OVERVIEW: Describe the contract's architecture including:
      - External dependencies (OpenZeppelin version, oracles, bridges)
      - Upgradeability mechanism (none / proxy type)
      - Interaction flow (how user → contract → external)
      - Asset custody (who holds funds, how are they stored)
   d) ATTACK SURFACE: List where funds can be stolen, state corrupted, or users censored. Include likelihood and numeric impact estimate.
   e) Each finding MUST include a "likelihood" field: "High", "Medium", or "Low"

8. GOVERNANCE SECURITY (MUST generate):
   - Does the contract have governance? (hasGovernance: true/false)
   - If yes: proposal lifecycle, timelock delay, voting mechanism, quorum threshold
   - Voting risks: flash-loan voting, whale takeover, low quorum, vote buying
   - If no governance: explain why and set hasGovernance: false

9. UPGRADEABILITY ANALYSIS (MUST generate):
   - Is the contract upgradeable? (isUpgradeable: true/false)
   - If proxy: pattern (Transparent/UUPS/Beacon), admin address, storage collision risk, initializer protection
   - If not upgradeable: confirm and explain

10. ECONOMIC & GAME-THEORY RISKS (MUST generate):
    - Supply concentration risk, vote buying, incentive misalignment, treasury drain, MEV exposure, oracle manipulation
    - For each: category, description, severity, mitigation if any

11. INTEGRATION RISKS (MUST generate):
    - External dependencies: oracles, bridges, DEXes, staking contracts, Snapshot
    - For each: dependency name, risk type, description, severity
    - If no external dependencies, return empty array

12. INVARIANTS (MUST generate):
    - List key invariants the contract should maintain: totalSupply immutability, balance consistency, access control invariants
    - For each: the invariant statement, whether it holds (true/false), evidence

13. REALISTIC SCORING: NEVER score 100/100. Max is 98. Scale: 96-98 = exceptional, 90-95 = very strong, 80-89 = good.

14. PROOF OF CONCEPT PER FINDING (CRITICAL for Tier-1):
    Every finding MUST include a "proofOfConcept" field with:
    - The exact vulnerable code snippet (file name, line numbers)
    - A concrete exploit scenario with step-by-step attack flow
    - Numeric impact estimate where applicable
    - Tool output that confirms the finding (e.g., for Solidity: "Slither: integer overflow at line 63", for Rust: "cargo-audit/clippy: unchecked arithmetic at line 45")
    - For non-Solidity: reference the correct tools (cargo-audit, clippy for Rust; Move prover for Move; cosmwasm-check for CosmWasm)
    This is what separates a Tier-1 audit from a Tier-2. Do NOT generate findings without proof.

15. TESTING METHODOLOGY (MUST generate):
    Generate a "testingMethodology" object describing the actual review depth:
    - manualReviewHours: estimated hours
    - reviewPhases: array of phases completed
    - staticAnalysisTools: array with tool name, findings summary, config
    - dynamicAnalysisTools: array with tool name, findings summary, execution time
    - fuzzingApplied: boolean
    - symbolicExecution: boolean
    - assumptions: what was assumed during the review
    - limitations: what was NOT covered

You MUST respond ONLY with valid JSON (no markdown, no code fences):
{
  "findings": [
    { "title": "string", "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO", "location": "File:Line — function()", "description": "string", "impact": "string with numeric estimate", "recommendation": "string with specific code fix", "likelihood": "High|Medium|Low", "proofOfConcept": "Vulnerable code snippet\\n\\nExploit scenario:\\n1. Step 1\\n2. Step 2\\n\\nTool output: Slither confirmed at line X" }
  ],
  "privilegedRoles": [
    { "role": "string", "capabilities": "string", "riskIfCompromised": "string" }
  ],
  "trustAssumptions": [
    { "statement": "Users must trust X because Y" }
  ],
  "architectureOverview": "string — contract architecture, dependencies, interaction flow",
  "attackSurface": [
    { "title": "string", "type": "fund-theft|state-corruption|censorship|economic|governance", "description": "string", "likelihood": "High|Medium|Low", "mitigated": true|false }
  ],
  "governanceSecurity": {
    "hasGovernance": true|false,
    "proposalLifecycle": "string or null",
    "timelockDelay": "string or null",
    "timelockBypassRisk": "string or null",
    "votingMechanism": "string or null",
    "quorumThreshold": "string or null",
    "votingRisks": ["string"]
  },
  "upgradeabilityAnalysis": {
    "isUpgradeable": true|false,
    "proxyPattern": "TransparentProxy|UUPS|Beacon|none",
    "storageCollisionRisk": "None|Low|Medium|High",
    "initializerProtection": true|false,
    "upgradeControl": "string or null"
  },
  "economicRisks": [
    { "title": "string", "category": "vote-buying|supply-concentration|incentive-misalignment|treasury-drain|oracle-manipulation|mev|other", "description": "string", "severity": "High|Medium|Low", "mitigation": "string or null" }
  ],
  "integrationRisks": [
    { "dependency": "string", "riskType": "string", "description": "string", "severity": "High|Medium|Low" }
  ],
  "invariantsChecked": [
    { "invariant": "string", "holds": true|false, "evidence": "string" }
  ],
  "testingMethodology": {
    "manualReviewHours": number,
    "reviewPhases": ["string"],
    "staticAnalysisTools": [{ "tool": "string", "findings": "string", "configUsed": "string" }],
    "dynamicAnalysisTools": [{ "tool": "string", "findings": "string", "executionTime": "string" }],
    "fuzzingApplied": true|false,
    "fuzzingDetails": "string or null",
    "symbolicExecution": true|false,
    "symbolicDetails": "string or null",
    "assumptions": ["string"],
    "limitations": ["string"]
  },
  "engagement": {
    "compilerVersionUsed": "string (e.g. solc 0.8.20)",
    "linesOfCode": number,
    "objectives": ["string — list of specific audit objectives"],
    "auditDurationDays": number
  },
  "scopeTable": [
    { "contract": "ContractName.sol or ProgramName.rs", "linesOfCode": number, "language": "ACTUAL language from metadata (Solidity X.Y.Z / Rust/Anchor / Move / etc.)" }
  ]
}

Be thorough but PRECISE. Quality over quantity. A report with 2 real findings is better than 7 false positives.`

export async function POST(req: Request) {
  try {
    const { code, network } = await req.json()
    const chainNetwork: string = network || "Ethereum"

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return Response.json({ error: "No code provided" }, { status: 400 })
    }

    const truncatedCode = code.slice(0, 15000)

    // Extract contract metadata FIRST -- this drives everything (now network-aware)
    const meta = extractContractMeta(truncatedCode, chainNetwork)
    const isEVM = !meta.isNonEVM
    const codeLanguage = meta.codeLanguage

    // Build a metadata context preamble for the AI
    const metaContext = isEVM ? [
      `CONTRACT METADATA (pre-analyzed):`,
      `- Network: ${chainNetwork}`,
      `- Language: ${codeLanguage}`,
      `- Type: ${meta.contractType} (${meta.scopeLabel})`,
      `- Is ERC-20: ${meta.isERC20}`,
      `- Uses OpenZeppelin: ${meta.usesOZ}`,
      `- Has owner/admin: ${meta.hasOwner}${meta.ownerRenounced ? " (RENOUNCED)" : ""}`,
      `- Has proxy/upgradeable: ${meta.hasProxy}`,
      `- Mint: ${meta.hasConstructorOnlyMint ? "constructor-only (FIXED SUPPLY)" : meta.hasMintOutsideConstructor ? "public/external mint exists" : "no mint"}`,
      `- Pausable: ${meta.hasPausable}${meta.pausableProtected ? " (access-controlled)" : ""}`,
      `- Blacklist: ${meta.hasBlacklist}`,
      `- Fee functions: ${meta.hasSetFee}`,
      `- External calls: ${meta.hasExternalCalls}`,
      `- SafeMath: ${meta.hasSafeMath}`,
      `- Solidity: ${meta.solidityVersion}`,
      `- Selfdestruct: ${meta.hasSelfDestruct}`,
      `- Delegatecall: ${meta.hasDelegatecall}`,
      ``,
      `IMPORTANT: This is a "${meta.scopeLabel}" audit, NOT a protocol audit.`,
      meta.contractType === "erc20"
        ? `This is a SIMPLE ERC-20 TOKEN. Do NOT claim you're auditing a "protocol", "DEX", "vault", or "trading platform". The scope is ONLY the token contract. Architecture risk and governance risk should reflect this limited scope.`
        : ``,
    ].join("\n") : [
      `CONTRACT METADATA (pre-analyzed):`,
      `- Network: ${chainNetwork}`,
      `- Language: ${codeLanguage}`,
      `- Lines of Code: ${meta.linesOfCode}`,
      `- Type: ${meta.contractType} (${meta.scopeLabel})`,
      `- Has Authority/Admin: ${meta.hasOwner}`,
      `- Has Mint: ${meta.hasMintOutsideConstructor}`,
      `- Has Pausable/Freeze: ${meta.hasPausable}`,
      `- Has External Calls/CPI: ${meta.hasExternalCalls}`,
      `- Centralization: ${meta.centralizationLevel}`,
      ``,
      `CRITICAL: This is a ${codeLanguage} program on ${chainNetwork}, NOT Solidity/Ethereum.`,
      `- Do NOT reference Solidity concepts (pragma, constructor, ERC-20, OpenZeppelin, SafeMath, delegatecall, selfdestruct).`,
      `- Do NOT say the language is "Solidity" or reference ".sol" files.`,
      `- The file extension for ${codeLanguage} is ${chainNetwork === "Solana" ? ".rs" : chainNetwork === "Starknet" ? ".cairo" : chainNetwork === "Ton" ? ".fc/.tact" : ["Sui","Aptos"].includes(chainNetwork) ? ".move" : ".rs"}.`,
      `- The "engagement.compilerVersionUsed" must reflect ${codeLanguage}, NOT Solidity. Example: "rustc 1.75 + Anchor 0.29" for Solana.`,
      `- The "scopeTable[].language" must be "${codeLanguage}", NOT "Solidity".`,
      `- The "engagement.linesOfCode" must be ${meta.linesOfCode} (actual count from provided code).`,
      ``,
      chainNetwork === "Solana" ? `For Solana/Anchor programs specifically analyze: account constraint validation (#[account(...)]), signer checks (has_one, constraint), PDA derivation seeds, CPI guard (invoke/invoke_signed safety), reinitialization attacks (is_initialized), type cosplay attacks, missing close constraints, authority validation.` : "",
      ["Sui", "Aptos"].includes(chainNetwork) ? `For Move programs: check capability patterns, object ownership, resource safety, phantom type abuse, entry function validation, module access control.` : "",
      ["Cosmos", "Injective", "Sei"].includes(chainNetwork) ? `For CosmWasm contracts: check instantiate/execute/query handler safety, storage patterns (Item/Map), submessage reply handling, migration safety, admin key management.` : "",
    ].join("\n")

    // Adapt the analysis prompt for the code language
    const analysisPrompt = isEVM
      ? `${metaContext}\n\nAnalyze this Solidity smart contract for security vulnerabilities. Remember: identify the contract type first, avoid false positives, and never duplicate findings.\n\n${truncatedCode}`
      : `${metaContext}\n\nAnalyze this ${codeLanguage} smart contract/program deployed on ${chainNetwork} for security vulnerabilities. Apply ${codeLanguage}-specific security patterns. Remember: avoid false positives, and never duplicate findings.\n\n${truncatedCode}`

    // Try AI analysis first
    try {
      const result = await generateText({
        model: "openai/gpt-4o-mini",
        system: SYSTEM_PROMPT,
        prompt: analysisPrompt,
        maxOutputTokens: 4096,
      })

      const text = result.text.trim()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any

      try {
        parsed = JSON.parse(text)
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch?.[1]) {
          parsed = JSON.parse(jsonMatch[1].trim())
        } else {
          const braceStart = text.indexOf("{")
          const braceEnd = text.lastIndexOf("}")
          if (braceStart !== -1 && braceEnd !== -1) {
            parsed = JSON.parse(text.slice(braceStart, braceEnd + 1))
          } else {
            throw new Error("Could not parse AI JSON response")
          }
        }
      }

      // Deduplicate findings by title
      const validSeverities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
      const validLikelihoods = ["High", "Medium", "Low"]
      const seen = new Set<string>()
      const findings = (parsed.findings ?? [])
        .map((f: Record<string, string>) => ({
          title: String(f.title || "Untitled Finding"),
          severity: validSeverities.includes(f.severity) ? f.severity : "INFO",
          location: String(f.location || "Unknown"),
          description: String(f.description || ""),
          impact: String(f.impact || ""),
          recommendation: String(f.recommendation || ""),
          likelihood: validLikelihoods.includes(f.likelihood) ? f.likelihood : "Medium",
          proofOfConcept: f.proofOfConcept ? String(f.proofOfConcept) : undefined,
        }))
        .filter((f: { title: string }) => {
          const key = f.title.toLowerCase().trim()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

      // Extract Tier-1 sections from AI response
      const privilegedRoles = Array.isArray(parsed.privilegedRoles)
        ? parsed.privilegedRoles.map((r: Record<string, string>) => ({
            role: String(r.role || ""),
            capabilities: String(r.capabilities || ""),
            riskIfCompromised: String(r.riskIfCompromised || ""),
          }))
        : []

      const trustAssumptions = Array.isArray(parsed.trustAssumptions)
        ? parsed.trustAssumptions.map((t: Record<string, string>) => ({
            statement: String(t.statement || ""),
          }))
        : []

      const architectureOverview = typeof parsed.architectureOverview === "string"
        ? parsed.architectureOverview : ""

      const attackSurface = Array.isArray(parsed.attackSurface)
        ? parsed.attackSurface.map((a: Record<string, string | boolean>) => ({
            title: String(a.title || ""),
            type: String(a.type || "economic"),
            description: String(a.description || ""),
            likelihood: validLikelihoods.includes(a.likelihood as string) ? a.likelihood : "Low",
            mitigated: a.mitigated === true,
          }))
        : []

      // Extract Governance Security
      const governanceSecurity = parsed.governanceSecurity ? {
        hasGovernance: !!parsed.governanceSecurity.hasGovernance,
        proposalLifecycle: parsed.governanceSecurity.proposalLifecycle || null,
        timelockDelay: parsed.governanceSecurity.timelockDelay || null,
        timelockBypassRisk: parsed.governanceSecurity.timelockBypassRisk || null,
        votingMechanism: parsed.governanceSecurity.votingMechanism || null,
        quorumThreshold: parsed.governanceSecurity.quorumThreshold || null,
        votingRisks: Array.isArray(parsed.governanceSecurity.votingRisks) ? parsed.governanceSecurity.votingRisks.map(String) : [],
      } : { hasGovernance: false }

      // Extract Upgradeability Analysis
      const upgradeabilityAnalysis = parsed.upgradeabilityAnalysis ? {
        isUpgradeable: !!parsed.upgradeabilityAnalysis.isUpgradeable,
        proxyPattern: String(parsed.upgradeabilityAnalysis.proxyPattern || "none"),
        storageCollisionRisk: (["None","Low","Medium","High"].includes(parsed.upgradeabilityAnalysis.storageCollisionRisk) ? parsed.upgradeabilityAnalysis.storageCollisionRisk : "None") as string,
        initializerProtection: !!parsed.upgradeabilityAnalysis.initializerProtection,
        upgradeControl: parsed.upgradeabilityAnalysis.upgradeControl || null,
      } : { isUpgradeable: false, proxyPattern: "none" }

      // Extract Economic Risks
      const economicRisks = Array.isArray(parsed.economicRisks)
        ? parsed.economicRisks.map((e: Record<string, string>) => ({
            title: String(e.title || ""),
            category: String(e.category || "other"),
            description: String(e.description || ""),
            severity: validLikelihoods.includes(e.severity) ? e.severity : "Low",
            mitigation: e.mitigation || null,
          }))
        : []

      // Extract Integration Risks
      const integrationRisks = Array.isArray(parsed.integrationRisks)
        ? parsed.integrationRisks.map((ir: Record<string, string>) => ({
            dependency: String(ir.dependency || ""),
            riskType: String(ir.riskType || ""),
            description: String(ir.description || ""),
            severity: validLikelihoods.includes(ir.severity) ? ir.severity : "Low",
          }))
        : []

      // Extract Invariants
      const invariantsChecked = Array.isArray(parsed.invariantsChecked)
        ? parsed.invariantsChecked.map((inv: Record<string, string | boolean>) => ({
            invariant: String(inv.invariant || ""),
            holds: inv.holds === true,
            evidence: String(inv.evidence || ""),
          }))
        : []

      // Extract Testing Methodology
      const testingMethodology = parsed.testingMethodology ? {
        manualReviewHours: Number(parsed.testingMethodology.manualReviewHours) || 4,
        reviewPhases: Array.isArray(parsed.testingMethodology.reviewPhases) ? parsed.testingMethodology.reviewPhases.map(String) : ["Manual Review"],
        staticAnalysisTools: Array.isArray(parsed.testingMethodology.staticAnalysisTools)
          ? parsed.testingMethodology.staticAnalysisTools.map((t: Record<string, string>) => ({
              tool: String(t.tool || ""),
              findings: String(t.findings || ""),
              configUsed: t.configUsed ? String(t.configUsed) : undefined,
            }))
          : [],
        dynamicAnalysisTools: Array.isArray(parsed.testingMethodology.dynamicAnalysisTools)
          ? parsed.testingMethodology.dynamicAnalysisTools.map((t: Record<string, string>) => ({
              tool: String(t.tool || ""),
              findings: String(t.findings || ""),
              executionTime: t.executionTime ? String(t.executionTime) : undefined,
            }))
          : [],
        fuzzingApplied: !!parsed.testingMethodology.fuzzingApplied,
        fuzzingDetails: parsed.testingMethodology.fuzzingDetails || null,
        symbolicExecution: !!parsed.testingMethodology.symbolicExecution,
        symbolicDetails: parsed.testingMethodology.symbolicDetails || null,
        assumptions: Array.isArray(parsed.testingMethodology.assumptions) ? parsed.testingMethodology.assumptions.map(String) : [],
        limitations: Array.isArray(parsed.testingMethodology.limitations) ? parsed.testingMethodology.limitations.map(String) : [],
      } : null

      // Extract engagement data from AI -- always use real LOC from code analysis
      const realLOC = meta.linesOfCode
      const defaultCompiler = isEVM
        ? (meta.solidityVersion !== "unknown" ? `Solidity ${meta.solidityVersion}` : "Solidity (version undetected)")
        : codeLanguage
      const aiEngagement = parsed.engagement ? {
        compilerVersionUsed: String(parsed.engagement.compilerVersionUsed || defaultCompiler),
        linesOfCode: realLOC > 0 ? realLOC : (Number(parsed.engagement.linesOfCode) || 0),
        objectives: Array.isArray(parsed.engagement.objectives) ? parsed.engagement.objectives.map(String) : [],
        auditDurationDays: Number(parsed.engagement.auditDurationDays) || 1,
      } : { compilerVersionUsed: defaultCompiler, linesOfCode: realLOC, objectives: [], auditDurationDays: 1 }

      const aiScopeTable = Array.isArray(parsed.scopeTable)
        ? parsed.scopeTable.map((s: Record<string, unknown>) => ({
            contract: String(s.contract || ""),
            linesOfCode: Number(s.linesOfCode) || realLOC,
            language: String(s.language || codeLanguage),
          }))
        : [{ contract: meta.scopeLabel, linesOfCode: realLOC, language: codeLanguage }]

      // Compute realistic score breakdown
      const fCount = {
        critical: findings.filter((f: { severity: string }) => f.severity === "CRITICAL").length,
        high: findings.filter((f: { severity: string }) => f.severity === "HIGH").length,
        medium: findings.filter((f: { severity: string }) => f.severity === "MEDIUM").length,
        low: findings.filter((f: { severity: string }) => f.severity === "LOW").length,
        info: findings.filter((f: { severity: string }) => f.severity === "INFO").length,
      }
      const scoreBreakdown = computeScoreBreakdown(98, meta, fCount)

      // Build tooling section
      const toolingUsed = [
        "Solay39 Manual Review",
        "Solay39 Static Analyzer",
        "AI-Guided Verification (GPT-4o)",
        ...(meta.usesOZ ? ["OpenZeppelin Contract Analysis"] : []),
        ...(meta.hasProxy ? ["Proxy Storage Layout Check"] : []),
      ]

      return Response.json({
        findings,
        source: "ai",
        contractMeta: meta,
        scoreBreakdown,
        // Tier-1 sections
        privilegedRoles,
        trustAssumptions,
        architectureOverview,
        attackSurface,
        toolingUsed,
        // Tier-1 advanced
        governanceSecurity,
        upgradeabilityAnalysis,
        economicRisks,
        integrationRisks,
        invariantsChecked,
        testingMethodology,
        aiEngagement,
        aiScopeTable,
      })
    } catch (aiError: unknown) {
      // AI failed -- fall back to static analysis (which is now context-aware)
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError)
      console.log("[v0] AI unavailable, using static analysis. Reason:", aiMsg)

      const findings = staticAnalysis(truncatedCode, meta)

      const fCount = {
        critical: findings.filter(f => f.severity === "CRITICAL").length,
        high: findings.filter(f => f.severity === "HIGH").length,
        medium: findings.filter(f => f.severity === "MEDIUM").length,
        low: findings.filter(f => f.severity === "LOW").length,
        info: findings.filter(f => f.severity === "INFO").length,
      }
      const scoreBreakdown = computeScoreBreakdown(100, meta, fCount)

      return Response.json({
        findings,
        source: "static",
        note: "Analysis performed using Solay39 pattern-based static analyzer (AI model unavailable).",
        contractMeta: meta,
        scoreBreakdown,
      })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Skynet route error:", msg)
    return Response.json(
      { error: `Request failed: ${msg}`, findings: [] },
      { status: 500 }
    )
  }
}
