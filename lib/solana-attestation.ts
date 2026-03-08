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
} from "@solana/web3.js"
import bs58 from "bs58"

// Memo Program ID — già deployato da Solana, nessun deploy necessario
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

// RPC endpoint — usa mainnet o devnet
const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"

/**
 * Carica il keypair del wallet Solana dalle env vars
 * SOLANA_PRIVATE_KEY può essere:
 * - Base58 string (export da Phantom/Solflare)
 * - Array JSON tipo [1,2,3,...,64]
 */
function loadWallet(): Keypair | null {
  try {
    const key = process.env.SOLANA_PRIVATE_KEY
    if (!key) return null

    if (!key.startsWith("[")) {
      const decoded = bs58.decode(key.trim())
      return Keypair.fromSecretKey(decoded)
    }

    const parsed = JSON.parse(key)
    return Keypair.fromSecretKey(Uint8Array.from(parsed))
  } catch (e) {
    console.error("[Solana] Failed to load wallet:", e)
    return null
  }
}

export interface SolanaAttestationResult {
  txSignature: string
  solscanUrl: string
  network: string
  memo: string
  timestamp: string
  pending?: boolean // true = transazione inviata ma non ancora confermata
}

/**
 * Registra un audit on-chain su Solana tramite Memo Program.
 *
 * STRATEGIA FIRE-AND-FORGET per rispettare il limite 10s di Vercel Free:
 * 1. Ottieni blockhash fresco (~200ms)
 * 2. Firma la transazione localmente (~0ms)
 * 3. Invia la transazione senza aspettare conferma (~500ms)
 * 4. Restituisci subito la firma — la TX è già nella mempool
 *
 * La conferma on-chain avviene in ~5-15 secondi dopo la risposta.
 * Il frontend può verificare su Solscan tramite l'URL restituito.
 */
export async function registerAuditOnSolana(
  auditId: string,
  reportHash: string,
  ipfsCid?: string
): Promise<SolanaAttestationResult | null> {
  console.log("[Solana] registerAuditOnSolana called:", {
    auditId,
    reportHash: reportHash?.slice(0, 20),
  })

  if (!auditId || !reportHash) {
    console.error("[Solana] Invalid input: auditId and reportHash are required")
    return null
  }

  const wallet = loadWallet()
  if (!wallet) {
    console.warn("[Solana] SOLANA_PRIVATE_KEY not configured — skipping attestation")
    return null
  }

  // "processed" è il commitment più veloce — non aspetta conferma
  const connection = new Connection(SOLANA_RPC, { commitment: "processed" })
  const network = SOLANA_RPC.includes("devnet") ? "devnet" : "mainnet"

  // Costruisce il memo compatto
  const memo = JSON.stringify({
    s: "solay39",
    id: auditId,
    h: reportHash.slice(0, 16),
    ipfs: ipfsCid ? ipfsCid.slice(0, 20) : undefined,
    t: Math.floor(Date.now() / 1000),
  })

  // Timeout aggressivo: max 7 secondi totali per stare dentro i 10s di Vercel
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 7_000)

  try {
    // Step 1: Ottieni blockhash fresco (veloce, ~100-300ms)
    console.log("[Solana] Fetching fresh blockhash...")
    const { blockhash } = await connection.getLatestBlockhash("processed")
    console.log("[Solana] Blockhash:", blockhash.slice(0, 12) + "...")

    // Step 2: Costruisci e firma la transazione localmente
    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    })

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    }).add(memoInstruction)

    transaction.sign(wallet)
    const rawTransaction = transaction.serialize()

    console.log("[Solana] Transaction signed, sending (fire-and-forget)...")

    // Step 3: Invia senza aspettare conferma (skipPreflight per massima velocità)
    const txSignature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,       // Salta la simulazione preflight → risposta immediata
      maxRetries: 2,             // 2 retry di invio rapidi
      preflightCommitment: "processed",
    })

    clearTimeout(timeoutId)

    const solscanUrl = network === "devnet"
      ? `https://solscan.io/tx/${txSignature}?cluster=devnet`
      : `https://solscan.io/tx/${txSignature}`

    console.log(`[Solana] ✓ TX inviata (in attesa conferma): ${solscanUrl}`)

    return {
      txSignature,
      solscanUrl,
      network,
      memo,
      timestamp: new Date().toISOString(),
      pending: true, // La TX è stata inviata ma non ancora confermata on-chain
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[Solana] Error sending transaction:", msg)
    return null
  }
}