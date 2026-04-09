/**
 * SOLAY39 — Casper Network Contract Fetcher
 * 
 * Fetches contract info, deploy data, and entry points from cspr.live
 * Casper uses Rust compiled to WASM, not Solidity.
 */

import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

interface CasperContractInfo {
  contractHash: string
  contractPackageHash?: string
  namedKeys: Record<string, string>
  entryPoints: {
    name: string
    args: { name: string; cl_type: string }[]
    access: string
    entry_point_type: string
  }[]
  deployHash?: string
  installer?: string
  timestamp?: string
}

// Casper RPC endpoint
const CASPER_RPC = "https://rpc.mainnet.casperlabs.io/rpc"
const CSPR_LIVE_API = "https://event-store-api-clarity-mainnet.make.services"

async function rpcCall(method: string, params: unknown) {
  const res = await fetch(CASPER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.result
}

export async function POST(req: NextRequest) {
  try {
    const { contractHash, accountHash } = await req.json()

    if (!contractHash && !accountHash) {
      return NextResponse.json({ error: "contractHash or accountHash required" }, { status: 400 })
    }

    const result: Partial<CasperContractInfo> = {}

    // Normalize hash format
    const hash = (contractHash || accountHash).replace(/^(contract-|hash-|account-hash-)/, "")
    const fullContractHash = contractHash ? `hash-${hash}` : undefined
    const fullAccountHash = accountHash ? `account-hash-${hash}` : undefined

    // 1. Get contract info from state_get_dictionary_item or state_get_item
    if (fullContractHash) {
      try {
        const stateRes = await rpcCall("state_get_item", {
          state_root_hash: null, // latest
          key: fullContractHash,
          path: [],
        })

        if (stateRes?.stored_value?.Contract) {
          const contract = stateRes.stored_value.Contract
          result.contractHash = fullContractHash
          result.contractPackageHash = contract.contract_package_hash
          result.namedKeys = contract.named_keys?.reduce((acc: Record<string, string>, nk: { name: string; key: string }) => {
            acc[nk.name] = nk.key
            return acc
          }, {}) || {}
          result.entryPoints = contract.entry_points?.map((ep: any) => ({
            name: ep.name,
            args: ep.args || [],
            access: ep.access?.toString() || "Public",
            entry_point_type: ep.entry_point_type || "Session",
          })) || []
        }
      } catch (e) {
        console.error("[casper] state_get_item error:", e)
      }
    }

    // 2. Try to get deploy history from cspr.live API
    try {
      const queryHash = fullContractHash || fullAccountHash
      const apiRes = await fetch(`${CSPR_LIVE_API}/contracts/${hash}`, {
        headers: { Accept: "application/json" },
      })
      if (apiRes.ok) {
        const apiData = await apiRes.json()
        result.deployHash = apiData.deploy_hash
        result.installer = apiData.from_account
        result.timestamp = apiData.timestamp
      }
    } catch {
      // cspr.live API is optional
    }

    // 3. Get account info if accountHash provided
    if (fullAccountHash) {
      try {
        const accountRes = await rpcCall("state_get_account_info", {
          account_identifier: { AccountHash: fullAccountHash },
          block_identifier: null,
        })
        if (accountRes?.account) {
          result.namedKeys = accountRes.account.named_keys?.reduce((acc: Record<string, string>, nk: { name: string; key: string }) => {
            acc[nk.name] = nk.key
            return acc
          }, {}) || {}
        }
      } catch (e) {
        console.error("[casper] account info error:", e)
      }
    }

    return NextResponse.json({
      success: true,
      network: "Casper",
      explorer: `https://cspr.live/contract/${hash}`,
      ...result,
      // Security analysis hints for Casper contracts
      securityHints: [
        "Verify entry point access controls (Public vs Groups)",
        "Check for unsafe unwrap() calls that can panic",
        "Validate URef access rights (READ, WRITE, ADD)",
        "Ensure proper gas forwarding for cross-contract calls",
        "Review named key validation before access",
      ],
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch Casper contract", details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hash = searchParams.get("hash")

  if (!hash) {
    return NextResponse.json({
      endpoint: "/api/casper-contract",
      description: "Fetch Casper Network contract info from cspr.live",
      usage: {
        POST: { contractHash: "hash-xxx or contract-xxx", accountHash: "account-hash-xxx" },
        GET: "?hash=xxx",
      },
      securityPatterns: [
        "CSPR-001: Unsafe unwrap() in Entry Points",
        "CSPR-002: Missing Access Control on Entry Points",
        "CSPR-003: Unbounded Dictionary Growth",
        "CSPR-004: Insufficient Gas for Nested Calls",
        "CSPR-005: Mutable Global State Misuse",
        "CSPR-006: Missing Named Key Validation",
      ],
    })
  }

  // Redirect GET to POST logic
  const contractHash = hash.includes("contract") || hash.includes("hash-") ? hash : `hash-${hash}`
  return POST(new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify({ contractHash }),
  }))
}
