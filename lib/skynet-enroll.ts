// Enrolls an audited contract into Skynet continuous monitoring
// (table skynet_subscriptions, polled by /api/skynet-realtime cron).

import { createClient } from "@supabase/supabase-js"

export interface MonitoringEnrollment {
  enrolled: boolean
  network: string
  contractAddress: string | null
  pollInterval: string
  watchedEvents: string[]
  reason?: string
  enrolledAt?: string
}

const SUPPORTED_NETWORKS: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "polygon",
  arbitrum: "arbitrum",
  base: "base",
  solana: "solana",
}

export const WATCHED_EVENTS = ["OWNERSHIP_TRANSFER", "UPGRADED", "PAUSED", "ROLE_GRANTED", "LARGE_TRANSFER", "MINT"]

export async function enrollPostAuditMonitoring(params: {
  contractAddress: string | null
  network: string
  auditId?: string
  projectName?: string
  criticalFindings: number
}): Promise<MonitoringEnrollment> {
  const network = SUPPORTED_NETWORKS[params.network.toLowerCase()]
  const base = {
    network: params.network,
    contractAddress: params.contractAddress,
    pollInterval: "5 min",
    watchedEvents: WATCHED_EVENTS,
  }
  if (!params.contractAddress) return { ...base, enrolled: false, reason: "No on-chain address supplied" }
  if (!network) return { ...base, enrolled: false, reason: `Network ${params.network} not yet supported by Skynet polling` }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ...base, enrolled: false, reason: "Database not configured" }

  const now = new Date().toISOString()
  const { error } = await createClient(url, key)
    .from("skynet_subscriptions")
    .upsert(
      {
        audit_id: params.auditId || `audit-${Date.now()}`,
        contract_address: network === "solana" ? params.contractAddress : params.contractAddress.toLowerCase(),
        network,
        status: "active",
        alert_config: {
          projectName: params.projectName ?? null,
          events: WATCHED_EVENTS,
          criticalFindingsAtAudit: params.criticalFindings,
        },
        updated_at: now,
      },
      { onConflict: "contract_address,network" },
    )

  if (error) return { ...base, enrolled: false, reason: error.message }
  return { ...base, network, enrolled: true, enrolledAt: now }
}
