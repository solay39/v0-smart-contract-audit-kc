// lib/solana-attestation.ts
// Registra l'hash dell'audit on-chain su Solana usando il Memo Program
// Costo: ~$0.000005 per audit — praticamente gratis
// Verificabile su: https://solscan.io/tx/[txSignature]

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js"

// Memo Program ID — già deployato da Solana, nessun deploy necessario
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

// RPC endpoint — usa mainnet o devnet
const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"

/**
 * Carica il keypair del wallet Solana dalle env vars
 * SOLANA_PRIVATE_KEY deve essere un array JSON tipo [1,2,3,...,64]
 */
function loadWallet(): Keypair | null {
  try {
    const key = process.env.SOLANA_PRIVATE_KEY
    if (!key) return null
    const parsed = JSON.parse(key)
    return Keypair.fromSecretKey(Uint8Array.from(parsed))
  } catch {
    return null
  }
}

export interface SolanaAttestationResult {
  txSignature: string
  solscanUrl: string
  network: string
  memo: string
  timestamp: string
}

/**
 * Registra un audit on-chain su Solana tramite Memo Program
 * Il memo contiene: auditId + reportHash + ipfsCid
 */
export async function registerAuditOnSolana(
  auditId: string,
  reportHash: string,
  ipfsCid?: string
): Promise<SolanaAttestationResult | null> {
  console.log("[v0] registerAuditOnSolana called with:", { auditId, reportHash: reportHash?.slice(0, 20), ipfsCid: ipfsCid?.slice(0, 20) })
  
  try {
    const wallet = loadWallet()
    console.log("[v0] Wallet loaded:", wallet ? `PublicKey: ${wallet.publicKey.toBase58()}` : "null (no SOLANA_PRIVATE_KEY)")
    
    if (!wallet) {
      console.warn("[Solana] SOLANA_PRIVATE_KEY not configured — skipping attestation")
      return null
    }

    const connection = new Connection(SOLANA_RPC, "confirmed")

    // Costruisce il memo con i dati dell'audit
    // Formato compatto per stare nei 566 bytes del Memo Program
    const memo = JSON.stringify({
      s: "solay39",           // source
      id: auditId,            // audit ID
      h: reportHash.slice(0, 16), // prime 16 chars dell'hash (abbastanza per identificare)
      ipfs: ipfsCid ? ipfsCid.slice(0, 20) : undefined, // CID abbreviato
      t: Math.floor(Date.now() / 1000), // unix timestamp
    })

    // Istruzione Memo — scrive dati on-chain
    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    })

    const transaction = new Transaction().add(memoInstruction)

    // Invia la transazione
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: "confirmed" }
    )

    const network = SOLANA_RPC.includes("devnet") ? "devnet" : "mainnet"
    const solscanUrl = network === "devnet"
      ? `https://solscan.io/tx/${txSignature}?cluster=devnet`
      : `https://solscan.io/tx/${txSignature}`

    console.log(`[Solana] Audit registered on-chain: ${solscanUrl}`)

    return {
      txSignature,
      solscanUrl,
      network,
      memo,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[Solana] Attestation failed:", error)
    return null
  }
}
