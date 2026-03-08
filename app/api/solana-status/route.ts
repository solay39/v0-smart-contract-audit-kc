export const runtime = "nodejs"

import { NextResponse } from "next/server"

export async function GET() {
  const hasPrivateKey = !!process.env.SOLANA_PRIVATE_KEY
  const hasRpcUrl = !!process.env.SOLANA_RPC_URL
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
  
  // Determina network dal RPC URL
  let network = "mainnet"
  if (rpcUrl.includes("devnet")) network = "devnet"
  else if (rpcUrl.includes("testnet")) network = "testnet"
  
  return NextResponse.json({
    configured: hasPrivateKey && hasRpcUrl,
    hasPrivateKey,
    hasRpcUrl,
    network,
    // Non esporre dati sensibili, solo stato
  })
}
