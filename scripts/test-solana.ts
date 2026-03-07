import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import bs58 from "bs58"

async function testSolanaConnection() {
  console.log("=== SOLANA CONNECTION TEST ===\n")
  
  // Check env vars
  const privateKey = process.env.SOLANA_PRIVATE_KEY
  const rpcUrl = process.env.SOLANA_RPC_URL
  
  console.log("SOLANA_PRIVATE_KEY:", privateKey ? `Set (${privateKey.length} chars)` : "NOT SET")
  console.log("SOLANA_RPC_URL:", rpcUrl || "NOT SET")
  
  if (!privateKey) {
    console.error("\nERROR: SOLANA_PRIVATE_KEY not set!")
    return
  }
  
  // Try to load wallet
  let wallet: Keypair | null = null
  try {
    if (!privateKey.startsWith("[")) {
      // Base58 format (from Phantom)
      console.log("\nDecoding base58 private key...")
      const decoded = bs58.decode(privateKey.trim())
      console.log("Decoded bytes length:", decoded.length)
      wallet = Keypair.fromSecretKey(decoded)
    } else {
      // JSON array format
      console.log("\nParsing JSON array private key...")
      const parsed = JSON.parse(privateKey)
      wallet = Keypair.fromSecretKey(Uint8Array.from(parsed))
    }
    console.log("Wallet public key:", wallet.publicKey.toBase58())
  } catch (e) {
    console.error("\nERROR loading wallet:", e)
    return
  }
  
  // Test RPC connection
  const rpc = rpcUrl || "https://api.mainnet-beta.solana.com"
  console.log("\nConnecting to RPC:", rpc)
  
  try {
    const connection = new Connection(rpc, "confirmed")
    const balance = await connection.getBalance(wallet.publicKey)
    console.log("Wallet balance:", balance / 1e9, "SOL")
    console.log("Balance in lamports:", balance)
    
    if (balance < 5000) {
      console.warn("\nWARNING: Balance too low! Need at least 5000 lamports (~0.000005 SOL)")
    } else {
      console.log("\n✓ Wallet has sufficient balance for transactions")
    }
    
    // Test blockhash fetch
    const { blockhash } = await connection.getLatestBlockhash()
    console.log("Latest blockhash:", blockhash.slice(0, 20) + "...")
    console.log("\n✓ RPC connection working!")
    
  } catch (e) {
    console.error("\nERROR connecting to RPC:", e)
  }
}

testSolanaConnection()
