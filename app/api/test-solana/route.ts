import { NextResponse } from "next/server"
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js"
import bs58 from "bs58"

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }
  
  // Check env vars
  const privateKey = process.env.SOLANA_PRIVATE_KEY
  const rpcUrl = process.env.SOLANA_RPC_URL
  
  results.envVars = {
    SOLANA_PRIVATE_KEY: privateKey ? `Set (${privateKey.length} chars, starts with: ${privateKey.slice(0, 8)}...)` : "NOT SET",
    SOLANA_RPC_URL: rpcUrl || "NOT SET (using default)",
  }
  
  if (!privateKey) {
    return NextResponse.json({ ...results, error: "SOLANA_PRIVATE_KEY not set" }, { status: 500 })
  }
  
  // Try to load wallet
  try {
    let wallet: Keypair
    
    if (privateKey.startsWith("[")) {
      const parsed = JSON.parse(privateKey)
      wallet = Keypair.fromSecretKey(Uint8Array.from(parsed))
      results.keyFormat = "JSON array"
    } else {
      const decoded = bs58.decode(privateKey.trim())
      wallet = Keypair.fromSecretKey(decoded)
      results.keyFormat = "Base58 string"
    }
    
    results.wallet = {
      publicKey: wallet.publicKey.toBase58(),
      loaded: true,
    }
    
    // Connect to RPC
    const connection = new Connection(rpcUrl || "https://api.mainnet-beta.solana.com", "confirmed")
    results.rpc = { url: rpcUrl || "https://api.mainnet-beta.solana.com" }
    
    // Get balance
    try {
      const balance = await connection.getBalance(wallet.publicKey)
      results.balance = {
        lamports: balance,
        sol: balance / 1e9,
        sufficient: balance >= 5000,
      }
    } catch (balanceErr) {
      results.balanceError = String(balanceErr)
    }
    
    // Try to send a test memo transaction
    try {
      const testMemo = JSON.stringify({
        s: "solay39-test",
        t: Math.floor(Date.now() / 1000),
      })
      
      const memoInstruction = new TransactionInstruction({
        keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(testMemo, "utf-8"),
      })
      
      const transaction = new Transaction().add(memoInstruction)
      
      const txSignature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        { commitment: "confirmed" }
      )
      
      const isDevnet = (rpcUrl || "").includes("devnet")
      const solscanUrl = isDevnet
        ? `https://solscan.io/tx/${txSignature}?cluster=devnet`
        : `https://solscan.io/tx/${txSignature}`
      
      results.testTransaction = {
        success: true,
        txSignature,
        solscanUrl,
        memo: testMemo,
      }
    } catch (txErr) {
      results.testTransaction = {
        success: false,
        error: String(txErr),
      }
    }
    
    return NextResponse.json(results)
    
  } catch (walletErr) {
    return NextResponse.json({
      ...results,
      walletError: String(walletErr),
      hint: "Check if SOLANA_PRIVATE_KEY is valid base58 or JSON array format",
    }, { status: 500 })
  }
}
