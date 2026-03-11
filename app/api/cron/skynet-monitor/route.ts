// ═══════════════════════════════════════════════════════════════════
// SKYNET 24/7 MONITORING CRON JOB
// Vercel Cron: runs every 5 minutes to monitor all tracked contracts
// 
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/skynet-monitor",
//     "schedule": "*/5 * * * *"
//   }]
// }
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes max

// Supported chains for monitoring
const CHAINS = {
  ethereum: {
    name: "Ethereum",
    rpc: "https://cloudflare-eth.com",
    explorer: "https://api.etherscan.io/v2/api?chainid=1",
  },
  bsc: {
    name: "BSC",
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://api.etherscan.io/v2/api?chainid=56",
  },
  base: {
    name: "Base",
    rpc: "https://mainnet.base.org",
    explorer: "https://api.etherscan.io/v2/api?chainid=8453",
  },
  arbitrum: {
    name: "Arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://api.etherscan.io/v2/api?chainid=42161",
  },
  polygon: {
    name: "Polygon",
    rpc: "https://polygon-rpc.com",
    explorer: "https://api.etherscan.io/v2/api?chainid=137",
  },
  solana: {
    name: "Solana",
    rpc: "https://api.mainnet-beta.solana.com",
    explorer: null,
  },
}

interface Alert {
  type: "OWNERSHIP_CHANGE" | "LP_REMOVED" | "WHALE_DUMP" | "MINT_DETECTED" | "BLACKLIST_ADDED" | "PAUSE_TRIGGERED"
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  contract: string
  chain: string
  details: string
  txHash?: string
  timestamp: string
}

interface MonitoredContract {
  address: string
  chain: keyof typeof CHAINS
  name: string
  lastOwner?: string
  lastLiquidity?: number
  lastTopHolder?: number
}

// In production, this would be stored in a database
// For now, we use environment variable to store JSON
function getMonitoredContracts(): MonitoredContract[] {
  try {
    const stored = process.env.SKYNET_MONITORED_CONTRACTS
    if (stored) {
      return JSON.parse(stored)
    }
  } catch { /* fallback to empty */ }
  return []
}

async function checkOwnershipChange(
  contract: MonitoredContract,
  etherscanKey: string
): Promise<Alert | null> {
  const chain = CHAINS[contract.chain]
  if (!chain.explorer) return null
  
  try {
    // Get recent internal transactions
    const url = `${chain.explorer}&module=account&action=txlistinternal&address=${contract.address}&page=1&offset=10&sort=desc&apikey=${etherscanKey}`
    const res = await fetch(url)
    const data = await res.json()
    
    if (data.status === "1" && data.result) {
      for (const tx of data.result) {
        // Check for ownership transfer patterns
        if (tx.input?.includes("f2fde38b") || // transferOwnership(address)
            tx.input?.includes("715018a6")) { // renounceOwnership()
          return {
            type: "OWNERSHIP_CHANGE",
            severity: "CRITICAL",
            contract: contract.address,
            chain: contract.chain,
            details: `Ownership change detected on ${contract.name}`,
            txHash: tx.hash,
            timestamp: new Date().toISOString(),
          }
        }
      }
    }
  } catch { /* continue */ }
  
  return null
}

async function checkLiquidityChange(
  contract: MonitoredContract,
): Promise<Alert | null> {
  try {
    // Get current liquidity from DEX Screener
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contract.address}`)
    const data = await res.json()
    const pair = data?.pairs?.[0]
    
    if (pair && contract.lastLiquidity) {
      const currentLiq = parseFloat(pair.liquidity?.usd || "0")
      const lastLiq = contract.lastLiquidity
      
      // Alert if liquidity dropped by more than 30%
      if (currentLiq < lastLiq * 0.7) {
        return {
          type: "LP_REMOVED",
          severity: "CRITICAL",
          contract: contract.address,
          chain: contract.chain,
          details: `Liquidity dropped from $${lastLiq.toLocaleString()} to $${currentLiq.toLocaleString()} (-${((1 - currentLiq/lastLiq) * 100).toFixed(1)}%)`,
          timestamp: new Date().toISOString(),
        }
      }
    }
  } catch { /* continue */ }
  
  return null
}

async function checkWhaleActivity(
  contract: MonitoredContract,
  etherscanKey: string
): Promise<Alert | null> {
  const chain = CHAINS[contract.chain]
  if (!chain.explorer) return null
  
  try {
    // Get top holders
    const url = `${chain.explorer}&module=token&action=tokenholderlist&contractaddress=${contract.address}&page=1&offset=10&apikey=${etherscanKey}`
    const res = await fetch(url)
    const data = await res.json()
    
    if (data.status === "1" && data.result) {
      // Check for large transfers from top holders
      const topHolder = data.result[0]
      if (topHolder && contract.lastTopHolder) {
        const currentBalance = BigInt(topHolder.TokenHolderQuantity || "0")
        const lastBalance = BigInt(contract.lastTopHolder)
        
        // Alert if top holder sold more than 50% of their position
        if (currentBalance < lastBalance / 2n) {
          return {
            type: "WHALE_DUMP",
            severity: "HIGH",
            contract: contract.address,
            chain: contract.chain,
            details: `Top holder sold >50% of position`,
            timestamp: new Date().toISOString(),
          }
        }
      }
    }
  } catch { /* continue */ }
  
  return null
}

async function checkMintActivity(
  contract: MonitoredContract,
  etherscanKey: string
): Promise<Alert | null> {
  const chain = CHAINS[contract.chain]
  if (!chain.explorer) return null
  
  try {
    // Get recent token transfers from zero address (mints)
    const url = `${chain.explorer}&module=account&action=tokentx&contractaddress=${contract.address}&address=0x0000000000000000000000000000000000000000&page=1&offset=5&sort=desc&apikey=${etherscanKey}`
    const res = await fetch(url)
    const data = await res.json()
    
    if (data.status === "1" && data.result?.length > 0) {
      // Check if any mints in last 10 minutes
      const tenMinutesAgo = Date.now() / 1000 - 600
      for (const tx of data.result) {
        if (parseInt(tx.timeStamp) > tenMinutesAgo) {
          return {
            type: "MINT_DETECTED",
            severity: "HIGH",
            contract: contract.address,
            chain: contract.chain,
            details: `New tokens minted: ${tx.value} to ${tx.to}`,
            txHash: tx.hash,
            timestamp: new Date().toISOString(),
          }
        }
      }
    }
  } catch { /* continue */ }
  
  return null
}

async function sendAlerts(alerts: Alert[]): Promise<void> {
  // Send to configured webhooks
  const webhookUrl = process.env.SKYNET_ALERT_WEBHOOK
  
  if (webhookUrl && alerts.length > 0) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "SOLAY39 Skynet",
          timestamp: new Date().toISOString(),
          alertCount: alerts.length,
          alerts,
        }),
      })
    } catch (err) {
      console.error("[Skynet] Failed to send webhook:", err)
    }
  }
  
  // Log alerts
  for (const alert of alerts) {
    console.log(`[Skynet Alert] ${alert.severity} - ${alert.type}: ${alert.details}`)
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets this header)
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const etherscanKey = process.env.ETHERSCAN_API_KEY || ""
  const contracts = getMonitoredContracts()
  
  if (contracts.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No contracts being monitored",
      monitored: 0,
    })
  }
  
  const allAlerts: Alert[] = []
  
  for (const contract of contracts) {
    // Run all checks in parallel
    const [ownership, liquidity, whale, mint] = await Promise.all([
      checkOwnershipChange(contract, etherscanKey),
      checkLiquidityChange(contract),
      checkWhaleActivity(contract, etherscanKey),
      checkMintActivity(contract, etherscanKey),
    ])
    
    if (ownership) allAlerts.push(ownership)
    if (liquidity) allAlerts.push(liquidity)
    if (whale) allAlerts.push(whale)
    if (mint) allAlerts.push(mint)
  }
  
  // Send alerts
  await sendAlerts(allAlerts)
  
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    monitored: contracts.length,
    alerts: allAlerts.length,
    details: allAlerts,
  })
}

// POST to add/remove monitored contracts
export async function POST(req: NextRequest) {
  try {
    const { action, contract } = await req.json()
    
    if (action === "add" && contract) {
      // In production, save to database
      console.log("[Skynet] Adding contract to monitoring:", contract)
      return NextResponse.json({ success: true, message: "Contract added" })
    }
    
    if (action === "remove" && contract) {
      console.log("[Skynet] Removing contract from monitoring:", contract)
      return NextResponse.json({ success: true, message: "Contract removed" })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
