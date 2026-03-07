import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import bs58 from "bs58"

const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"

console.log("=== SOLANA CONNECTION TEST ===")
console.log("")

// Check env vars
console.log("1. Checking environment variables...")
console.log("   SOLANA_PRIVATE_KEY:", SOLANA_PRIVATE_KEY ? `Set (${SOLANA_PRIVATE_KEY.length} chars)` : "NOT SET")
console.log("   SOLANA_RPC_URL:", SOLANA_RPC_URL)
console.log("")

if (!SOLANA_PRIVATE_KEY) {
  console.error("ERROR: SOLANA_PRIVATE_KEY not set!")
  process.exit(1)
}

// Load wallet
console.log("2. Loading wallet from private key...")
let wallet
try {
  if (!SOLANA_PRIVATE_KEY.startsWith("[")) {
    // Base58 format
    const decoded = bs58.decode(SOLANA_PRIVATE_KEY.trim())
    console.log("   Decoded base58, got", decoded.length, "bytes")
    wallet = Keypair.fromSecretKey(decoded)
  } else {
    // JSON array format
    const parsed = JSON.parse(SOLANA_PRIVATE_KEY)
    wallet = Keypair.fromSecretKey(Uint8Array.from(parsed))
  }
  console.log("   SUCCESS! Public Key:", wallet.publicKey.toBase58())
} catch (e) {
  console.error("   FAILED to load wallet:", e.message)
  process.exit(1)
}
console.log("")

// Test RPC connection
console.log("3. Testing RPC connection...")
try {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed")
  const balance = await connection.getBalance(wallet.publicKey)
  console.log("   SUCCESS! Balance:", balance / 1e9, "SOL")
  
  if (balance < 5000) {
    console.warn("   WARNING: Balance too low for transactions (need at least 0.000005 SOL)")
  }
} catch (e) {
  console.error("   FAILED to connect:", e.message)
  process.exit(1)
}

console.log("")
console.log("=== ALL TESTS PASSED ===")
