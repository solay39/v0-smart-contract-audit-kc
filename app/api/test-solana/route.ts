import { NextResponse } from "next/server"
import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import bs58 from "bs58"

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY ? `Set (${process.env.SOLANA_PRIVATE_KEY.length} chars)` : "NOT SET",
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ? `Set: ${process.env.SOLANA_RPC_URL.slice(0, 50)}...` : "NOT SET",
    }
  }

  // Test wallet loading
  try {
    const key = process.env.SOLANA_PRIVATE_KEY
    if (!key) {
      results.wallet = { error: "SOLANA_PRIVATE_KEY not set" }
    } else {
      let wallet: Keypair
      if (!key.startsWith("[")) {
        // Base58 format
        const decoded = bs58.decode(key.trim())
        results.keyFormat = "base58"
        results.decodedLength = decoded.length
        wallet = Keypair.fromSecretKey(decoded)
      } else {
        // JSON array format
        const parsed = JSON.parse(key)
        results.keyFormat = "json_array"
        results.arrayLength = parsed.length
        wallet = Keypair.fromSecretKey(Uint8Array.from(parsed))
      }
      results.wallet = {
        publicKey: wallet.publicKey.toBase58(),
        loaded: true
      }

      // Test RPC connection
      const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
      results.rpcUrl = rpcUrl
      
      const connection = new Connection(rpcUrl, "confirmed")
      
      try {
        const balance = await connection.getBalance(wallet.publicKey)
        results.balance = {
          lamports: balance,
          sol: balance / 1e9,
          sufficient: balance > 5000
        }
      } catch (balanceErr) {
        results.balance = { error: String(balanceErr) }
      }

      // Test slot (basic RPC health check)
      try {
        const slot = await connection.getSlot()
        results.rpcHealth = { slot, status: "connected" }
      } catch (slotErr) {
        results.rpcHealth = { error: String(slotErr) }
      }
    }
  } catch (err) {
    results.error = String(err)
  }

  return NextResponse.json(results, { status: 200 })
}
