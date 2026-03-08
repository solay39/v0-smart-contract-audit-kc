// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — On-Chain Monitoring
// app/api/monitor/route.ts
//
// Registra contratti auditati per monitoring live via Alchemy.
// Alert su: large transfers, ownership change, pause events, exploits.
// ═══════════════════════════════════════════════════════════════════

export const maxDuration = 30
import { NextRequest, NextResponse } from "next/server"

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || ""
const ALCHEMY_NOTIFY_URL = "https://dashboard.alchemy.com/api/create-webhook"

// Network to Alchemy network mapping
const NETWORK_MAP: Record<string, string> = {
  Ethereum:    "ETH_MAINNET",
  BSC:         "BNB_MAINNET",
  "BNB Chain": "BNB_MAINNET",
  Polygon:     "MATIC_MAINNET",
  Arbitrum:    "ARB_MAINNET",
  Optimism:    "OPT_MAINNET",
  Base:        "BASE_MAINNET",
  Avalanche:   "AVAX_MAINNET",
}

// ── Known event signatures to watch ──────────────────────────────
const ALERT_TOPICS = {
  // ERC-20
  Transfer:           "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  Approval:           "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  // Ownable
  OwnershipTransferred: "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0",
  // Pausable
  Paused:             "0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258",
  Unpaused:           "0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa",
  // Proxy
  Upgraded:           "0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b",
  AdminChanged:       "0x7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f",
}

// ── Webhook payload types ─────────────────────────────────────────
interface MonitorRequest {
  contractAddress: string
  contractName: string
  network: string
  auditId: string
  webhookUrl?: string      // Optional: user's own webhook endpoint
  alertEmail?: string      // Optional: email for alerts
  thresholds?: {
    largeTransferUSD?: number   // Default: $100k
    largeTransferTokens?: number
  }
}

interface WebhookActivity {
  fromAddress: string
  toAddress: string
  blockNum: string
  hash: string
  value: string
  asset: string
  category: string
  log?: {
    address: string
    topics: string[]
    data: string
  }
}

// ── Storage: track monitored contracts in Blob ────────────────────
// In production: use Vercel Blob or KV store
const monitoredContracts: Record<string, {
  contractAddress: string
  contractName: string
  network: string
  auditId: string
  webhookId?: string
  alertEmail?: string
  webhookUrl?: string
  addedAt: string
  alertCount: number
  lastAlert?: string
}> = {}

// ── Register contract for monitoring ─────────────────────────────
async function registerAlchemyWebhook(
  contractAddress: string,
  network: string,
  callbackUrl: string
): Promise<{ webhookId: string; status: string } | null> {
  if (!ALCHEMY_API_KEY) return null

  const alchemyNetwork = NETWORK_MAP[network]
  if (!alchemyNetwork) return null

  try {
    // Alchemy Address Activity Webhook
    const res = await fetch("https://dashboard.alchemy.com/api/create-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Alchemy-Token": ALCHEMY_API_KEY,
      },
      body: JSON.stringify({
        network: alchemyNetwork,
        webhook_type: "ADDRESS_ACTIVITY",
        webhook_url: callbackUrl,
        addresses: [contractAddress.toLowerCase()],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[monitor] Alchemy webhook error:", err)
      return null
    }

    const data = await res.json()
    return {
      webhookId: data.data?.id || data.id || "pending",
      status: "registered",
    }
  } catch (e) {
    console.error("[monitor] Alchemy webhook failed:", e)
    return null
  }
}

// ── Analyze incoming webhook activity for alerts ──────────────────
function analyzeActivity(
  activity: WebhookActivity[],
  config: { largeTransferUSD?: number; contractAddress: string }
): Array<{ type: string; severity: string; message: string; txHash: string }> {
  const alerts: Array<{ type: string; severity: string; message: string; txHash: string }> = []
  const threshold = config.largeTransferUSD || 100000

  for (const act of activity) {
    // Large transfer detection
    if (act.category === "token" || act.category === "external") {
      const valueNum = parseFloat(act.value || "0")
      if (valueNum > threshold) {
        alerts.push({
          type: "LARGE_TRANSFER",
          severity: "HIGH",
          message: `Large transfer detected: ${act.value} ${act.asset} from ${act.fromAddress.slice(0,8)}... to ${act.toAddress.slice(0,8)}...`,
          txHash: act.hash,
        })
      }
    }

    // Check event logs for critical events
    if (act.log) {
      const topic0 = act.log.topics[0]

      if (topic0 === ALERT_TOPICS.OwnershipTransferred) {
        alerts.push({
          type: "OWNERSHIP_CHANGED",
          severity: "CRITICAL",
          message: `⚠️ Ownership transferred! New owner: ${act.log.topics[2]?.slice(-40)}`,
          txHash: act.hash,
        })
      }

      if (topic0 === ALERT_TOPICS.Paused) {
        alerts.push({
          type: "CONTRACT_PAUSED",
          severity: "HIGH",
          message: "🔴 Contract has been PAUSED — all transfers halted",
          txHash: act.hash,
        })
      }

      if (topic0 === ALERT_TOPICS.Upgraded) {
        alerts.push({
          type: "PROXY_UPGRADED",
          severity: "CRITICAL",
          message: `🔄 Proxy implementation UPGRADED to: ${act.log.topics[1]?.slice(-40)}`,
          txHash: act.hash,
        })
      }

      if (topic0 === ALERT_TOPICS.AdminChanged) {
        alerts.push({
          type: "ADMIN_CHANGED",
          severity: "CRITICAL",
          message: `👤 Proxy admin changed! New admin: ${act.log.data?.slice(-40)}`,
          txHash: act.hash,
        })
      }
    }
  }

  return alerts
}

// ── Routes ────────────────────────────────────────────────────────

// POST /api/monitor — Register a contract for monitoring
export async function POST(req: NextRequest) {
  try {
    const body: MonitorRequest = await req.json()
    const { contractAddress, contractName, network, auditId, alertEmail, webhookUrl, thresholds } = body

    if (!contractAddress || !network || !auditId) {
      return NextResponse.json({ error: "Missing contractAddress, network, or auditId" }, { status: 400 })
    }

    // The callback URL for Alchemy to POST activity to
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.solay39.eu"
    const callbackUrl = `${baseUrl}/api/monitor/webhook?auditId=${auditId}&key=${process.env.SOLAY39_FOUNDER_KEY || ""}`

    // Register with Alchemy
    const webhook = await registerAlchemyWebhook(contractAddress, network, callbackUrl)

    // Store monitoring config
    monitoredContracts[auditId] = {
      contractAddress,
      contractName,
      network,
      auditId,
      webhookId: webhook?.webhookId,
      alertEmail,
      webhookUrl,
      addedAt: new Date().toISOString(),
      alertCount: 0,
    }

    return NextResponse.json({
      success: true,
      auditId,
      contractAddress,
      network,
      monitoring: {
        status: webhook ? "active" : "simulated",
        webhookId: webhook?.webhookId || "no-alchemy-key",
        watching: [
          "Large transfers (>$" + (thresholds?.largeTransferUSD || 100000).toLocaleString() + ")",
          "Ownership transfers",
          "Contract pause/unpause",
          "Proxy upgrades",
          "Admin changes",
        ],
        callbackUrl: ALCHEMY_API_KEY ? callbackUrl : "configure ALCHEMY_API_KEY to activate",
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/monitor — List monitored contracts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const auditId = searchParams.get("auditId")

  if (auditId) {
    const contract = monitoredContracts[auditId]
    if (!contract) {
      return NextResponse.json({ error: "Not monitored" }, { status: 404 })
    }
    return NextResponse.json({ contract, alchemyActive: !!ALCHEMY_API_KEY })
  }

  return NextResponse.json({
    monitored: Object.values(monitoredContracts),
    total: Object.keys(monitoredContracts).length,
    alchemyActive: !!ALCHEMY_API_KEY,
  })
}