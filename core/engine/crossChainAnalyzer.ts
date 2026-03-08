/**
 * Cross-Chain Analyzer - Analyzes bridge, LayerZero, and cross-chain messaging security
 * Detects message replay, peer validation, endpoint security
 */

export interface CrossChainVulnerability {
  type: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  description: string
  attackVector: string
  mitigation: string
  lineNumber?: number
}

export interface CrossChainAnalysisResult {
  isLayerZero: boolean
  isWormhole: boolean
  isAxelar: boolean
  isHyperlane: boolean
  isCustomBridge: boolean
  protocol: string | null
  vulnerabilities: CrossChainVulnerability[]
  securityFeatures: string[]
  recommendations: string[]
}

// Analyze cross-chain messaging security
export function analyzeCrossChain(code: string): CrossChainAnalysisResult {
  const vulnerabilities: CrossChainVulnerability[] = []
  const securityFeatures: string[] = []
  const recommendations: string[] = []

  // Detect protocols
  const isLayerZero = /LayerZero|OFT|OAPP|ILayerZeroEndpoint|lzReceive|_lzSend|NonblockingLzApp/.test(code)
  const isWormhole = /Wormhole|IWormhole|publishMessage|parseAndVerifyVM|IWormholeRelayer/.test(code)
  const isAxelar = /Axelar|IAxelarGateway|IAxelarExecutable|AxelarExecutable/.test(code)
  const isHyperlane = /Hyperlane|IMailbox|IInterchainSecurityModule|handle\(.*origin/.test(code)
  const isCustomBridge = !isLayerZero && !isWormhole && !isAxelar && !isHyperlane &&
    /bridge|Bridge|crossChain|remoteChain|sourceChain/.test(code)

  const protocol = isLayerZero ? "LayerZero" :
                  isWormhole ? "Wormhole" :
                  isAxelar ? "Axelar" :
                  isHyperlane ? "Hyperlane" :
                  isCustomBridge ? "Custom Bridge" : null

  // LayerZero specific checks
  if (isLayerZero) {
    // Peer configuration
    if (/setPeer|setPeers|trustedRemote/.test(code)) {
      securityFeatures.push("Peer configuration implemented")
    } else {
      vulnerabilities.push({
        type: "MISSING_PEER_VALIDATION",
        severity: "CRITICAL",
        description: "LayerZero OApp/OFT lacks peer configuration. Messages from any source chain will be accepted.",
        attackVector: "Attacker deploys malicious contract on another chain, sends fraudulent messages to drain funds",
        mitigation: "Implement setPeer() and validate _origin.sender in lzReceive()",
      })
    }

    // lzReceive validation
    if (!/lzReceive.*require|_lzReceive.*require/.test(code)) {
      vulnerabilities.push({
        type: "UNVALIDATED_LZ_RECEIVE",
        severity: "HIGH",
        description: "lzReceive() handler lacks input validation. Malformed messages may cause unexpected behavior.",
        attackVector: "Attacker sends malformed payload causing state corruption or DoS",
        mitigation: "Validate all decoded parameters in lzReceive(), use try/catch for abi.decode",
      })
    }

    // Message ordering
    if (/NonblockingLzApp/.test(code)) {
      securityFeatures.push("NonblockingLzApp pattern used (recommended)")
    } else if (!/failedMessages|storedPayload/.test(code)) {
      vulnerabilities.push({
        type: "BLOCKING_LZ_RECEIVE",
        severity: "MEDIUM",
        description: "lzReceive() can revert and block the message channel. Failed messages cannot be retried.",
        attackVector: "Single malicious message can permanently block cross-chain transfers",
        mitigation: "Use NonblockingLzApp pattern or implement manual retry mechanism",
      })
    }

    // Gas estimation
    if (!/estimateFees|estimateGas/.test(code)) {
      vulnerabilities.push({
        type: "MISSING_GAS_ESTIMATION",
        severity: "LOW",
        description: "No gas estimation for cross-chain messages. Users may overpay or messages may fail.",
        attackVector: "User sends with insufficient gas, message stuck in limbo",
        mitigation: "Implement estimateFees() to calculate required gas before sending",
      })
    }
  }

  // Wormhole specific checks
  if (isWormhole) {
    // VAA verification
    if (/parseAndVerifyVM|verifyVM/.test(code)) {
      securityFeatures.push("VAA verification implemented")
    } else {
      vulnerabilities.push({
        type: "MISSING_VAA_VERIFICATION",
        severity: "CRITICAL",
        description: "Wormhole messages not verified against guardian signatures. Any message will be accepted.",
        attackVector: "Attacker creates fake VAA to mint tokens or steal funds",
        mitigation: "Always use parseAndVerifyVM() from IWormhole core contract",
      })
    }

    // Emitter validation
    if (!/registeredEmitter|trustedEmitter|knownEmitter/.test(code)) {
      vulnerabilities.push({
        type: "MISSING_EMITTER_VALIDATION",
        severity: "HIGH",
        description: "No validation of message emitter address. Messages from any contract on source chain accepted.",
        attackVector: "Attacker deploys rogue emitter on source chain to spoof messages",
        mitigation: "Maintain registry of trusted emitters per chain and validate in receiveWormholeMessages()",
      })
    }

    // Replay protection
    if (!/hash.*processed|messageHash|consumedMessage/.test(code)) {
      vulnerabilities.push({
        type: "MESSAGE_REPLAY_RISK",
        severity: "HIGH",
        description: "No replay protection for Wormhole messages. Same message can be processed multiple times.",
        attackVector: "Attacker replays valid message to double-spend or re-execute actions",
        mitigation: "Store processed message hashes and reject duplicates",
      })
    }
  }

  // Axelar specific checks
  if (isAxelar) {
    // Gateway validation
    if (/onlyAxelarGateway|_execute.*gateway/.test(code)) {
      securityFeatures.push("Gateway validation in _execute()")
    } else {
      vulnerabilities.push({
        type: "MISSING_GATEWAY_VALIDATION",
        severity: "CRITICAL",
        description: "Axelar _execute() can be called by anyone, not just the gateway.",
        attackVector: "Attacker directly calls _execute() with forged sourceChain and sourceAddress",
        mitigation: "Use AxelarExecutable base contract which validates msg.sender == gateway",
      })
    }

    // Source validation
    if (!/trustedSource|approvedSender|sourceChain.*require/.test(code)) {
      vulnerabilities.push({
        type: "MISSING_SOURCE_VALIDATION",
        severity: "HIGH",
        description: "No validation of sourceChain or sourceAddress in _execute(). Any source accepted.",
        attackVector: "Attacker sends message from unauthorized chain/contract",
        mitigation: "Maintain allowlist of trusted (sourceChain, sourceAddress) pairs",
      })
    }
  }

  // Hyperlane specific checks
  if (isHyperlane) {
    // ISM configuration
    if (/interchainSecurityModule|IInterchainSecurityModule/.test(code)) {
      securityFeatures.push("Custom ISM configured")
    }

    // Handle validation
    if (!/handle.*require.*origin|_checkOrigin/.test(code)) {
      vulnerabilities.push({
        type: "MISSING_ORIGIN_VALIDATION",
        severity: "HIGH",
        description: "handle() doesn't validate message origin. Messages from any domain accepted.",
        attackVector: "Attacker sends message from unsupported chain",
        mitigation: "Validate origin domain and sender in handle() or use Router pattern",
      })
    }
  }

  // Custom bridge checks
  if (isCustomBridge) {
    vulnerabilities.push({
      type: "CUSTOM_BRIDGE_AUDIT_REQUIRED",
      severity: "HIGH",
      description: "Custom bridge implementation detected. Bridge security requires extensive manual review.",
      attackVector: "Bridge exploits have caused $2B+ in losses (Ronin, Wormhole, Nomad)",
      mitigation: "Consider using established protocols (LayerZero, Wormhole, Axelar) instead of custom implementation",
    })

    // Check for common bridge issues
    if (!/merkleRoot|merkleProof|proof/.test(code)) {
      vulnerabilities.push({
        type: "NO_MERKLE_PROOF",
        severity: "CRITICAL",
        description: "Bridge lacks merkle proof verification. No cryptographic guarantee of message validity.",
        attackVector: "Attacker submits fake deposit/withdrawal claims",
        mitigation: "Implement merkle tree for batch verification or use multi-sig relay",
      })
    }

    if (!/relayer|validator|guardian/.test(code)) {
      vulnerabilities.push({
        type: "CENTRALIZED_BRIDGE",
        severity: "HIGH",
        description: "Bridge appears to have single relayer/admin. Single point of failure.",
        attackVector: "Compromised relayer can approve fraudulent transfers",
        mitigation: "Implement multi-sig or threshold signature scheme for relayers",
      })
    }
  }

  // Generic cross-chain recommendations
  if (protocol) {
    recommendations.push(`Using ${protocol} - ensure you're on the latest version`)
    recommendations.push("Test cross-chain flows on testnet before mainnet deployment")
    recommendations.push("Implement rate limiting for large cross-chain transfers")
    recommendations.push("Consider timelock for admin functions that affect cross-chain parameters")
  }

  if (vulnerabilities.some(v => v.severity === "CRITICAL")) {
    recommendations.push("CRITICAL: Do not deploy to mainnet until cross-chain security issues are resolved")
  }

  return {
    isLayerZero,
    isWormhole,
    isAxelar,
    isHyperlane,
    isCustomBridge,
    protocol,
    vulnerabilities,
    securityFeatures,
    recommendations,
  }
}

// Generate cross-chain attack scenarios
export function generateCrossChainAttackScenarios(protocol: string | null): string[] {
  const scenarios: string[] = []

  if (protocol === "LayerZero") {
    scenarios.push(`
// LayerZero Peer Spoofing Attack
Chain A: Legitimate OFT deployed at 0xAAA
Chain B: Victim OFT without peer validation at 0xBBB

1. Attacker deploys malicious OFT on Chain A at 0xFAKE
2. Attacker calls _lzSend() from 0xFAKE to Chain B
3. Message arrives at 0xBBB on Chain B
4. lzReceive() executes without checking peer
5. Attacker mints unlimited tokens on Chain B
6. Drains liquidity pools

Mitigation: setPeer(chainIdA, abi.encodePacked(0xAAA))
`)
  }

  if (protocol === "Wormhole") {
    scenarios.push(`
// Wormhole Emitter Spoofing Attack (Nomad-style)
1. Attacker finds bridge without emitter validation
2. Deploys contract on Chain A that emits fake deposit event
3. Creates message payload: "Deposit 1M USDC for attacker"
4. Message is signed by guardians (it's a valid message format)
5. Attacker submits VAA to Chain B
6. Bridge mints 1M USDC to attacker

Mitigation: Validate emitter address matches registered bridge on source chain
`)
  }

  scenarios.push(`
// Message Replay Attack (Generic)
1. User legitimately bridges 100 ETH from A to B
2. Transaction completes, user receives 100 ETH on B
3. Attacker captures the valid signed message
4. Replays exact same message to bridge on B
5. Bridge processes again (no replay protection)
6. Extra 100 ETH minted

Mitigation: Track processed message hashes, reject duplicates
`)

  return scenarios
}
