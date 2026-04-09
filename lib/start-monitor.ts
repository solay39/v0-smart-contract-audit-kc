/**
 * Runtime Exploit Monitor
 * 
 * Real-time monitoring for exploit attempts.
 * Detects suspicious patterns on-chain.
 */

import { ethers } from "ethers"

export interface MonitorConfig {
  rpcUrl: string
  contractAddresses: string[]
  alertWebhook?: string
  telegramBotToken?: string
  telegramChatId?: string
}

export interface SuspiciousActivity {
  type: "flash_loan" | "large_transfer" | "unusual_call" | "failed_attack" | "reentrancy" | "price_manipulation"
  severity: "low" | "medium" | "high" | "critical"
  txHash: string
  blockNumber: number
  from: string
  to: string
  value: string
  data?: string
  timestamp: Date
  details: string
}

export interface MonitorStats {
  blocksMonitored: number
  transactionsAnalyzed: number
  alertsTriggered: number
  lastBlock: number
  uptime: number
}

type AlertCallback = (activity: SuspiciousActivity) => void

export class RuntimeMonitor {
  private provider: ethers.JsonRpcProvider
  private contracts: Set<string>
  private alertCallbacks: AlertCallback[] = []
  private stats: MonitorStats = {
    blocksMonitored: 0,
    transactionsAnalyzed: 0,
    alertsTriggered: 0,
    lastBlock: 0,
    uptime: 0,
  }
  private startTime: number = Date.now()
  private isRunning: boolean = false
  private config: MonitorConfig

  // Known flash loan providers
  private flashLoanProviders = new Set([
    "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9", // Aave V2
    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave V3
    "0x1F98431c8aD98523631AE4a59f267346ea31F984", // Uniswap V3
    "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer
    "0x0000000000000000000000000000000000000000", // Placeholder for others
  ].map(a => a.toLowerCase()))

  // Known exploit patterns (simplified)
  private exploitSignatures = [
    { name: "Price Manipulation", pattern: /swap.*amount.*minOut/i },
    { name: "Governance Attack", pattern: /propose.*vote.*execute/i },
    { name: "Bridge Exploit", pattern: /deposit.*withdraw.*signature/i },
    { name: "Flash Loan Attack", pattern: /flashloan.*exploit/i },
  ]

  // Address labels for profiling
  private addressLabels = new Map<string, string>([
    ["0x0000000000000000000000000000000000000000", "Burn Address"],
    ["0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9", "Aave V2 Pool"],
    ["0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", "Aave V3 Pool"],
    ["0x1F98431c8aD98523631AE4a59f267346ea31F984", "Uniswap V3 Factory"],
    ["0xBA12222222228d8Ba445958a75a0704d566BF2C8", "Balancer Vault"],
    ["0xae7ab96520de3a18e5e111b5eaab095312d7fe84", "Lido: stETH Token"],
    ["0x1e59d7bA14cA0168393F421C260714E24f11b6f0", "Known Hacker Address (Euler Finance Exploit)"],
    ["0x0c99557675fA2609079A3f0380a061413158fD8C", "Known Hacker Address (KyberSwap Exploit)"],
    ["0x53c9f2b8a7f1e7a4b64f9b8a8f1a8a1e8a1e8a1e", "Potential Attack Bot (Frequent Failed Txs)"],
  ])

  constructor(config: MonitorConfig) {
    this.config = config
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
    this.contracts = new Set(config.contractAddresses.map(a => a.toLowerCase()))
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    this.startTime = Date.now()

    console.log(`[Monitor] Starting real-time monitoring for ${this.contracts.size} contracts...`)

    // Monitor new blocks
    this.provider.on("block", async (blockNumber) => {
      try {
        await this.analyzeBlock(blockNumber)
      } catch (err) {
        console.error(`[Monitor] Error analyzing block ${blockNumber}:`, err)
      }
    })

    // Monitor pending transactions (mempool)
    this.provider.on("pending", async (txHash) => {
      try {
        await this.analyzePendingTx(txHash)
      } catch {
        // Pending tx may disappear, ignore errors
      }
    })
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false
    this.provider.removeAllListeners()
    console.log("[Monitor] Stopped")
  }

  /**
   * Add alert callback
   */
  onAlert(callback: AlertCallback): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Analyze a block
   */
  private async analyzeBlock(blockNumber: number): Promise<void> {
    const block = await this.provider.getBlock(blockNumber, true)
    if (!block || !block.transactions) return

    this.stats.blocksMonitored++
    this.stats.lastBlock = blockNumber

    // Map to track trades within a block for sandwich detection
    const tradesByAddress = new Map<string, any[]>()

    for (const tx of block.prefetchedTransactions) {
      if (!tx.to) continue
      
      this.stats.transactionsAnalyzed++

      // Track trades for sandwich detection
      const toAddr = tx.to.toLowerCase()
      if (toAddr.includes("swap") || toAddr.includes("router") || toAddr.includes("exchange")) {
        const addrTrades = tradesByAddress.get(tx.from.toLowerCase()) || []
        addrTrades.push(tx)
        tradesByAddress.set(tx.from.toLowerCase(), addrTrades)
      }

      // Check if transaction involves our monitored contracts
      if (this.contracts.has(tx.to.toLowerCase())) {
        await this.analyzeTransaction(tx, blockNumber)
      }

      // Check for flash loan providers
      if (this.flashLoanProviders.has(tx.to.toLowerCase())) {
        await this.analyzeFlashLoan(tx, blockNumber)
      }
    }

    // Check for sandwich attacks in the block
    for (const [addr, trades] of tradesByAddress.entries()) {
      if (trades.length >= 2) {
        // Potential sandwich: multiple trades from same address in same block
        this.triggerAlert({
          type: "price_manipulation",
          severity: "high",
          txHash: trades[0].hash,
          blockNumber,
          from: addr,
          to: trades[0].to!,
          value: "0",
          timestamp: new Date(),
          details: `Potential sandwich attack: ${trades.length} trades from same address in single block`,
        })
      }
    }
  }

  /**
   * Analyze pending transaction (mempool)
   */
  private async analyzePendingTx(txHash: string): Promise<void> {
    const tx = await this.provider.getTransaction(txHash)
    if (!tx?.to) return

    if (this.contracts.has(tx.to.toLowerCase())) {
      // Could be a pending attack - alert immediately
      this.triggerAlert({
        type: "unusual_call",
        severity: "medium",
        txHash: tx.hash,
        blockNumber: 0,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        data: tx.data.slice(0, 100),
        timestamp: new Date(),
        details: "Pending transaction to monitored contract detected in mempool",
      })

      // Check for exploit signatures in calldata
      for (const sig of this.exploitSignatures) {
        if (sig.pattern.test(tx.data)) {
          this.triggerAlert({
            type: "failed_attack",
            severity: "critical",
            txHash: tx.hash,
            blockNumber: 0,
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value),
            data: tx.data.slice(0, 100),
            timestamp: new Date(),
            details: `CRITICAL: Detected exploit pattern "${sig.name}" in pending transaction!`,
          })
        }
      }
    }
  }

  /**
   * Analyze transaction to monitored contract
   */
  private async analyzeTransaction(
    tx: ethers.TransactionResponse,
    blockNumber: number
  ): Promise<void> {
    // Get receipt for more details
    const receipt = await this.provider.getTransactionReceipt(tx.hash)
    if (!receipt) return

    // Check for failed transactions (potential attack attempts)
    if (receipt.status === 0) {
      this.triggerAlert({
        type: "failed_attack",
        severity: "medium",
        txHash: tx.hash,
        blockNumber,
        from: tx.from,
        to: tx.to!,
        value: ethers.formatEther(tx.value),
        data: tx.data.slice(0, 200),
        timestamp: new Date(),
        details: `Failed transaction to monitored contract. Gas used: ${receipt.gasUsed.toString()}`,
      })
      return
    }

    // Check for large value transfers
    if (tx.value > ethers.parseEther("100")) {
      this.triggerAlert({
        type: "large_transfer",
        severity: "high",
        txHash: tx.hash,
        blockNumber,
        from: tx.from,
        to: tx.to!,
        value: ethers.formatEther(tx.value),
        timestamp: new Date(),
        details: `Large ETH transfer: ${ethers.formatEther(tx.value)} ETH`,
      })
    }

    // Check for reentrancy patterns (multiple calls in same tx)
    const logs = receipt.logs.filter(l => 
      this.contracts.has(l.address.toLowerCase())
    )
    if (logs.length > 5) {
      this.triggerAlert({
        type: "reentrancy",
        severity: "critical",
        txHash: tx.hash,
        blockNumber,
        from: tx.from,
        to: tx.to!,
        value: ethers.formatEther(tx.value),
        timestamp: new Date(),
        details: `Suspicious activity: ${logs.length} events from monitored contract in single tx. Likely reentrancy or batch attack.`,
      })
    }

    // Check for flash loan funding for the attacker
    for (const log of receipt.logs) {
      if (this.flashLoanProviders.has(log.address.toLowerCase())) {
        this.triggerAlert({
          type: "flash_loan",
          severity: "critical",
          txHash: tx.hash,
          blockNumber,
          from: tx.from,
          to: tx.to!,
          value: ethers.formatEther(tx.value),
          timestamp: new Date(),
          details: `CRITICAL: Flash loan funded transaction interacting with monitored contract!`,
        })
        break
      }
    }
  }

  /**
   * Analyze flash loan transaction
   */
  private async analyzeFlashLoan(
    tx: ethers.TransactionResponse,
    blockNumber: number
  ): Promise<void> {
    const receipt = await this.provider.getTransactionReceipt(tx.hash)
    if (!receipt) return

    // Check if flash loan interacts with our contracts
    const involvesOurContracts = receipt.logs.some(l =>
      this.contracts.has(l.address.toLowerCase())
    )

    if (involvesOurContracts) {
      this.triggerAlert({
        type: "flash_loan",
        severity: "critical",
        txHash: tx.hash,
        blockNumber,
        from: tx.from,
        to: tx.to!,
        value: ethers.formatEther(tx.value),
        timestamp: new Date(),
        details: "Flash loan detected interacting with monitored contract!",
      })
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(activity: SuspiciousActivity): Promise<void> {
    this.stats.alertsTriggered++

    console.log(`[ALERT] ${activity.type.toUpperCase()} - ${activity.severity}`)
    console.log(`  TX: ${activity.txHash}`)
    console.log(`  Details: ${activity.details}`)

    // Call all registered callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(activity)
      } catch (err) {
        console.error("[Monitor] Alert callback error:", err)
      }
    }

    // Send webhook if configured
    if (this.config.alertWebhook) {
      await this.sendWebhook(activity)
    }

    // Send Telegram if configured
    if (this.config.telegramBotToken && this.config.telegramChatId) {
      await this.sendTelegram(activity)
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhook(activity: SuspiciousActivity): Promise<void> {
    try {
      await fetch(this.config.alertWebhook!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activity.type,
          severity: activity.severity,
          txHash: activity.txHash,
          blockNumber: activity.blockNumber,
          details: activity.details,
          timestamp: activity.timestamp.toISOString(),
        }),
      })
    } catch (err) {
      console.error("[Monitor] Webhook failed:", err)
    }
  }

  /**
   * Send Telegram alert
   */
  private async sendTelegram(activity: SuspiciousActivity): Promise<void> {
    const severityEmoji = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🚨",
      critical: "🔴",
    }

    const message = `
${severityEmoji[activity.severity]} **SECURITY ALERT**

Type: ${activity.type.toUpperCase()}
Severity: ${activity.severity.toUpperCase()}

TX: \`${activity.txHash}\`
Block: ${activity.blockNumber}
From: \`${activity.from}\`
To: \`${activity.to}\`
Value: ${activity.value} ETH

${activity.details}
`

    try {
      await fetch(`https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      })
    } catch (err) {
      console.error("[Monitor] Telegram failed:", err)
    }
  }

  /**
   * Get monitor stats
   */
  getStats(): MonitorStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    }
  }

  /**
   * Add contract to monitoring
   */
  addContract(address: string): void {
    this.contracts.add(address.toLowerCase())
  }

  /**
   * Remove contract from monitoring
   */
  removeContract(address: string): void {
    this.contracts.delete(address.toLowerCase())
  }
}

/**
 * Create and start monitor
 */
export function startMonitor(config: MonitorConfig): RuntimeMonitor {
  const monitor = new RuntimeMonitor(config)
  monitor.start()
  return monitor
}
