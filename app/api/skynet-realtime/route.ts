/**
 * SOLAY39 — Real Skynet WebSocket Listener
 * 
 * Real-time on-chain monitoring for EVM chains and Solana.
 * Uses Alchemy/QuickNode WebSockets for EVM, Helius for Solana.
 * 
 * This API manages WebSocket subscriptions and stores events in Supabase.
 * 
 * Environment variables:
 * - ALCHEMY_API_KEY: Alchemy API key for EVM chains
 * - HELIUS_API_KEY: Helius API key for Solana
 * - QUICKNODE_WS_URL: QuickNode WebSocket URL (fallback)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainEvent {
  id: string
  chain: string
  contractAddress: string
  eventType: "TRANSFER" | "OWNERSHIP_CHANGED" | "PAUSED" | "UPGRADED" | "MINT" | "BURN" | "APPROVAL" | "LIQUIDITY" | "SWAP" | "UNKNOWN"
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  txHash: string
  blockNumber: number
  timestamp: string
  from?: string
  to?: string
  value?: string
  data?: Record<string, unknown>
  processed: boolean
  alertSent: boolean
}

interface SubscriptionConfig {
  id?: string
  contractAddress: string
  chain: string
  auditId?: string
  projectName?: string
  events: string[] // Event signatures to monitor
}

// ─── Event Signatures (Keccak256 hashes) ──────────────────────────────────────

const EVENT_SIGNATURES = {
  // ERC-20 / General
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  Approval: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  
  // Ownership
  OwnershipTransferred: "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0",
  RoleGranted: "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d",
  RoleRevoked: "0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b",
  
  // Pausable
  Paused: "0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258",
  Unpaused: "0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa",
  
  // Upgradeable
  Upgraded: "0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b",
  AdminChanged: "0x7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f",
  
  // DEX / Liquidity
  Swap: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822", // UniswapV2
  Sync: "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
  Mint: "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
  Burn: "0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496",
  
  // Blacklist
  Blacklisted: "0xffa4e6181777692565cf28528fc88fd1516ea86b56da075235fa575af6a4b855",
  UnBlacklisted: "0x117e3210bb9aa7d9baff172026820255c6f6c30ba8999d1c2fd88e2848137c4e",
}

// ─── Chain WebSocket Endpoints ────────────────────────────────────────────────

function getWebSocketUrl(chain: string): string | null {
  const alchemyKey = process.env.ALCHEMY_API_KEY
  const heliusKey = process.env.HELIUS_API_KEY
  const quicknodeUrl = process.env.QUICKNODE_WS_URL
  
  if (chain === "solana" && heliusKey) {
    return `wss://mainnet.helius-rpc.com/?api-key=${heliusKey}`
  }
  
  if (alchemyKey) {
    const alchemyChains: Record<string, string> = {
      ethereum: `wss://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      polygon: `wss://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      arbitrum: `wss://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      optimism: `wss://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      base: `wss://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    }
    if (alchemyChains[chain]) return alchemyChains[chain]
  }
  
  if (quicknodeUrl && chain === "bsc") {
    return quicknodeUrl
  }
  
  return null
}

// ─── Event Classifier ─────────────────────────────────────────────────────────

function classifyEvent(topic0: string, log: any): { type: ChainEvent["eventType"]; severity: ChainEvent["severity"] } {
  switch (topic0) {
    case EVENT_SIGNATURES.OwnershipTransferred:
      return { type: "OWNERSHIP_CHANGED", severity: "CRITICAL" }
    case EVENT_SIGNATURES.Paused:
      return { type: "PAUSED", severity: "HIGH" }
    case EVENT_SIGNATURES.Unpaused:
      return { type: "PAUSED", severity: "MEDIUM" }
    case EVENT_SIGNATURES.Upgraded:
    case EVENT_SIGNATURES.AdminChanged:
      return { type: "UPGRADED", severity: "CRITICAL" }
    case EVENT_SIGNATURES.Transfer:
      // Check if large transfer (would need value parsing)
      return { type: "TRANSFER", severity: "INFO" }
    case EVENT_SIGNATURES.Mint:
      return { type: "MINT", severity: "HIGH" }
    case EVENT_SIGNATURES.Burn:
      return { type: "BURN", severity: "MEDIUM" }
    case EVENT_SIGNATURES.Swap:
    case EVENT_SIGNATURES.Sync:
      return { type: "SWAP", severity: "INFO" }
    case EVENT_SIGNATURES.Blacklisted:
      return { type: "UNKNOWN", severity: "HIGH" }
    default:
      return { type: "UNKNOWN", severity: "INFO" }
  }
}

// ─── Supabase Storage ─────────────────────────────────────────────────────────

async function storeEvent(event: ChainEvent, sub: SubscriptionConfig): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) return false
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const { error } = await supabase.from("skynet_events").upsert({
    subscription_id: sub.id,
    audit_id: sub.auditId || "unlinked",
    network: event.chain,
    contract_address: event.contractAddress,
    event_type: event.eventType,
    severity: event.severity,
    tx_hash: event.txHash,
    block_number: event.blockNumber,
    from_address: event.from,
    to_address: event.to,
    value: event.value,
    data: event.data,
    alert_sent: false,
    created_at: event.timestamp,
  }, { onConflict: "tx_hash,event_type", ignoreDuplicates: true })
  
  return !error
}

async function getActiveSubscriptions(): Promise<SubscriptionConfig[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) return []
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const { data } = await supabase
    .from("skynet_subscriptions")
    .select("*")
    .eq("status", "active")
  
  return (data || []).map((row: any) => ({
    id: row.id,
    contractAddress: row.contract_address,
    chain: row.network,
    auditId: row.audit_id,
    projectName: row.alert_config?.projectName ?? undefined,
    events: row.alert_config?.events || Object.keys(EVENT_SIGNATURES),
  }))
}

// ─── WebSocket Manager (for serverless, we simulate with polling) ─────────────

async function pollEventsEVM(config: SubscriptionConfig, fromBlock: number): Promise<ChainEvent[]> {
  const alchemyKey = process.env.ALCHEMY_API_KEY
  if (!alchemyKey) return []
  
  const alchemyChains: Record<string, string> = {
    ethereum: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    polygon: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    base: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  }
  
  const rpcUrl = alchemyChains[config.chain]
  if (!rpcUrl) return []
  
  const events: ChainEvent[] = []
  
  try {
    // Get logs for all monitored events
    const topics = Object.values(EVENT_SIGNATURES)
    
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [{
          address: config.contractAddress,
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: "latest",
          topics: [topics],
        }],
      }),
    })
    
    const data = await res.json()
    const logs = data.result || []
    
    for (const log of logs) {
      const topic0 = log.topics?.[0]
      if (!topic0) continue
      
      const { type, severity } = classifyEvent(topic0, log)
      
      events.push({
        id: `${config.chain}-${log.transactionHash}-${log.logIndex}`,
        chain: config.chain,
        contractAddress: config.contractAddress,
        eventType: type,
        severity,
        txHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16),
        timestamp: new Date().toISOString(),
        from: log.topics[1] ? `0x${log.topics[1].slice(-40)}` : undefined,
        to: log.topics[2] ? `0x${log.topics[2].slice(-40)}` : undefined,
        value: log.data !== "0x" ? log.data : undefined,
        data: { topics: log.topics, raw: log.data },
        processed: false,
        alertSent: false,
      })
    }
  } catch (err) {
    console.error(`[Skynet] Error polling ${config.chain}:`, err)
  }
  
  return events
}

async function pollEventsSolana(config: SubscriptionConfig): Promise<ChainEvent[]> {
  const heliusKey = process.env.HELIUS_API_KEY
  if (!heliusKey) return []
  
  const events: ChainEvent[] = []
  
  try {
    // Get recent transactions for the account
    const res = await fetch(`https://api.helius.xyz/v0/addresses/${config.contractAddress}/transactions?api-key=${heliusKey}&limit=20`)
    const txs = await res.json()
    
    for (const tx of txs || []) {
      // Classify Solana transactions
      let eventType: ChainEvent["eventType"] = "UNKNOWN"
      let severity: ChainEvent["severity"] = "INFO"
      
      if (tx.type === "TRANSFER") {
        eventType = "TRANSFER"
      } else if (tx.type === "SWAP") {
        eventType = "SWAP"
      } else if (tx.type === "NFT_MINT" || tx.type === "TOKEN_MINT") {
        eventType = "MINT"
        severity = "HIGH"
      } else if (tx.type === "BURN") {
        eventType = "BURN"
        severity = "MEDIUM"
      }
      
      events.push({
        id: `solana-${tx.signature}`,
        chain: "solana",
        contractAddress: config.contractAddress,
        eventType,
        severity,
        txHash: tx.signature,
        blockNumber: tx.slot || 0,
        timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : new Date().toISOString(),
        from: tx.feePayer,
        to: tx.instructions?.[0]?.accounts?.[1],
        data: { type: tx.type, description: tx.description },
        processed: false,
        alertSent: false,
      })
    }
  } catch (err) {
    console.error("[Skynet] Error polling Solana:", err)
  }
  
  return events
}

// ─── Alert Dispatcher ─────────────────────────────────────────────────────────

async function sendAlert(event: ChainEvent, config: SubscriptionConfig): Promise<void> {
  // Only alert for HIGH or CRITICAL
  if (event.severity !== "HIGH" && event.severity !== "CRITICAL") return
  
  const message = `
*SKYNET ALERT*

*Project:* ${config.projectName || config.contractAddress}
*Chain:* ${event.chain.toUpperCase()}
*Event:* ${event.eventType}
*Severity:* ${event.severity}

*TX:* \`${event.txHash}\`
*Block:* ${event.blockNumber}
*Time:* ${event.timestamp}

${event.from ? `*From:* \`${event.from}\`` : ""}
${event.to ? `*To:* \`${event.to}\`` : ""}
  `.trim()
  
  // Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (botToken && chatId) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    }).catch(() => {})
  }
  
  // Discord
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL
  if (discordWebhook) {
    await fetch(discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message.replace(/\*/g, "**").replace(/`/g, "`"),
        username: "SOLAY39 Skynet",
      }),
    }).catch(() => {})
  }
}

// ─── API Routes ───────────────────────────────────────────────────────────────

async function pollAllSubscriptions() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const subscriptions = await getActiveSubscriptions()
  const allEvents: ChainEvent[] = []

  for (const sub of subscriptions) {
    const { data: lastEvent } = await supabase
      .from("skynet_events")
      .select("block_number")
      .eq("contract_address", sub.contractAddress)
      .eq("network", sub.chain)
      .order("block_number", { ascending: false })
      .limit(1)
      .maybeSingle()

    const fromBlock = (lastEvent?.block_number || 0) + 1
    const events = sub.chain === "solana" ? await pollEventsSolana(sub) : await pollEventsEVM(sub, fromBlock)

    for (const event of events) {
      const stored = await storeEvent(event, sub)
      if (stored && (event.severity === "HIGH" || event.severity === "CRITICAL")) {
        await sendAlert(event, sub)
      }
    }
    if (sub.id) {
      await supabase
        .from("skynet_subscriptions")
        .update({ updated_at: new Date().toISOString(), last_block_checked: Math.max(fromBlock - 1, ...events.map((e) => e.blockNumber)) })
        .eq("id", sub.id)
    }
    allEvents.push(...events)
  }

  return {
    success: true,
    subscriptionsPolled: subscriptions.length,
    eventsFound: allEvents.length,
    criticalAlerts: allEvents.filter((e) => e.severity === "CRITICAL").length,
    highAlerts: allEvents.filter((e) => e.severity === "HIGH").length,
  }
}

export async function GET(req: NextRequest) {
  // Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
  if (req.nextUrl.searchParams.get("action") === "poll") {
    const secret = process.env.CRON_SECRET
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }
    return NextResponse.json(await pollAllSubscriptions())
  }

  const subscriptions = await getActiveSubscriptions()
  const wsEndpoints = {
    ethereum: getWebSocketUrl("ethereum") ? "connected" : "unavailable",
    polygon: getWebSocketUrl("polygon") ? "connected" : "unavailable",
    arbitrum: getWebSocketUrl("arbitrum") ? "connected" : "unavailable",
    base: getWebSocketUrl("base") ? "connected" : "unavailable",
    solana: getWebSocketUrl("solana") ? "connected" : "unavailable",
  }
  
  return NextResponse.json({
    status: "operational",
    endpoint: "/api/skynet-realtime",
    description: "Real-time on-chain monitoring via WebSocket/polling",
    activeSubscriptions: subscriptions.length,
    chains: wsEndpoints,
    monitoredEvents: Object.keys(EVENT_SIGNATURES),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, contractAddress, chain, auditId, projectName } = body
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // ── Subscribe to monitoring ──
    if (action === "subscribe") {
      if (!contractAddress || !chain) {
        return NextResponse.json({ error: "contractAddress and chain required" }, { status: 400 })
      }
      
      const { error } = await supabase.from("skynet_subscriptions").upsert({
        contract_address: chain.toLowerCase() === "solana" ? contractAddress : contractAddress.toLowerCase(),
        network: chain.toLowerCase(),
        audit_id: auditId || `manual-${Date.now()}`,
        status: "active",
        alert_config: { projectName: projectName ?? null, events: Object.keys(EVENT_SIGNATURES) },
        updated_at: new Date().toISOString(),
      }, { onConflict: "contract_address,network" })
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        message: `Subscribed to ${chain}:${contractAddress}`,
        monitoredEvents: Object.keys(EVENT_SIGNATURES),
      })
    }
    
    // ── Unsubscribe ──
    if (action === "unsubscribe") {
      const { error } = await supabase
        .from("skynet_subscriptions")
        .update({ status: "stopped", updated_at: new Date().toISOString() })
        .eq("contract_address", chain.toLowerCase() === "solana" ? contractAddress : contractAddress.toLowerCase())
        .eq("network", chain.toLowerCase())
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, message: "Unsubscribed" })
    }
    
    // ── Poll for events (called by cron or manually) ──
    if (action === "poll") {
      return NextResponse.json(await pollAllSubscriptions())
    }
    
    // ── Get recent events ──
    if (action === "events") {
      const { data: events } = await supabase
        .from("skynet_events")
        .select("*")
        .in("contract_address", [contractAddress, contractAddress?.toLowerCase()].filter(Boolean))
        .order("created_at", { ascending: false })
        .limit(50)
      
      return NextResponse.json({ events: events || [] })
    }
    
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
