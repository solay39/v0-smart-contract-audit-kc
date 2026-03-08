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
} from "@solana/web3.js"
import bs58 from "bs58"

// Memo Program ID — già deployato da Solana, nessun deploy necessario
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")

// RPC endpoint — usa mainnet o devnet
const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"

// Numero massimo di retry in caso di blockhash scaduto
const MAX_RETRIES = 3

/**
 * Carica il keypair del wallet Solana dalle env vars
 * SOLANA_PRIVATE_KEY puo' essere:
 * - Base58 string (export da Phantom/Solflare)
 * - Array JSON tipo [1,2,3,...,64]
 */
function loadWallet(): Keypair | null {
  try {
    const key = process.env.SOLANA_PRIVATE_KEY
    if (!key) return null

    // Prova prima come base58 (formato Phantom export)
    if (!key.startsWith("[")) {
      const decoded = bs58.decode(key.trim())
      return Keypair.fromSecretKey(decoded)
    }

    // Altrimenti prova come array JSON
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
}

/**
 * Registra un audit on-chain su Solana tramite Memo Program
 * Il memo contiene: auditId + reportHash + ipfsCid
 *
 * FIX: Ogni tentativo ottiene un blockhash FRESCO dalla chain.
 * Questo risolve l'errore "Signature has expired: block height exceeded"
 * che si verifica quando il blockhash nella transazione è già scaduto
 * al momento dell'invio (tipicamente dopo ~60-90 secondi su mainnet).
 */
export async function registerAuditOnSolana(
  auditId: string,
  reportHash: string,
  ipfsCid?: string
): Promise<SolanaAttestationResult | null> {
  console.log("[Solana] registerAuditOnSolana called with:", {
    auditId,
    reportHash: reportHash?.slice(0, 20),
    ipfsCid: ipfsCid?.slice(0, 20),
  })

  // Validazione input
  if (!auditId || !reportHash) {
    console.error("[Solana] Invalid input: auditId and reportHash are required")
    return null
  }

  let wallet: Keypair | null = null
  try {
    wallet = loadWallet()
    console.log(
      "[v0] Wallet loaded:",
      wallet ? `PublicKey: ${wallet.publicKey.toBase58()}` : "null (no SOLANA_PRIVATE_KEY)"
    )

    if (!wallet) {
      console.warn("[Solana] SOLANA_PRIVATE_KEY not configured — skipping attestation")
      return null
    }

    // Usa "finalized" su mainnet per maggiore affidabilità,
    // "confirmed" su devnet per velocità
    const commitment = SOLANA_RPC.includes("devnet") ? "confirmed" : "finalized"
    const connection = new Connection(SOLANA_RPC, {
      commitment,
      // Aumenta il timeout di conferma a 120 secondi (default è 30s)
      confirmTransactionInitialTimeout: 120_000,
    })

    // Costruisce il memo con i dati dell'audit
    // Formato compatto per stare nei 566 bytes del Memo Program
    const memo = JSON.stringify({
      s: "solay39",                           // source
      id: auditId,                            // audit ID
      h: reportHash.slice(0, 16),             // prime 16 chars dell'hash
      ipfs: ipfsCid ? ipfsCid.slice(0, 20) : undefined, // CID abbreviato
      t: Math.floor(Date.now() / 1000),       // unix timestamp
    })

    let lastError: unknown = null

    // ── RETRY LOOP — ogni tentativo usa un blockhash fresco ──
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Solana] Attempt ${attempt}/${MAX_RETRIES} — fetching fresh blockhash...`)

        // FIX PRINCIPALE: ottieni un blockhash fresco prima di ogni tentativo.
        // Questo garantisce che la transazione non sia già scaduta al momento dell'invio.
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment)

        console.log(`[Solana] Fresh blockhash: ${blockhash.slice(0, 12)}... (valid until block ${lastValidBlockHeight})`)

        // Istruzione Memo — scrive dati on-chain
        const memoInstruction = new TransactionInstruction({
          keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(memo, "utf-8"),
        })

        // Costruisce la transazione con il blockhash FRESCO
        const transaction = new Transaction({
          recentBlockhash: blockhash,
          feePayer: wallet.publicKey,
        }).add(memoInstruction)

        // Invia e conferma con il blockhash fresco.
        // skipPreflight: false → esegui preflight simulation per errori veloci.
        // maxRetries: 0 → gestiamo noi il retry con blockhash fresco ad ogni tentativo.
        const txSignature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [wallet],
          {
            commitment,
            skipPreflight: false,
            maxRetries: 0, // Non fare retry interni — gestiamo noi col blockhash fresco
            preflightCommitment: "processed",
          }
        )

        const network = SOLANA_RPC.includes("devnet") ? "devnet" : "mainnet"
        const solscanUrl =
          network === "devnet"
            ? `https://solscan.io/tx/${txSignature}?cluster=devnet`
            : `https://solscan.io/tx/${txSignature}`

        console.log(`[Solana] ✓ Audit registered on-chain (attempt ${attempt}): ${solscanUrl}`)

        return {
          txSignature,
          solscanUrl,
          network,
          memo,
          timestamp: new Date().toISOString(),
        }
      } catch (err: unknown) {
        lastError = err
        const msg = err instanceof Error ? err.message : String(err)

        // Se è un errore di blockhash scaduto, riprova immediatamente con blockhash fresco
        const isExpiredBlockhash =
          msg.includes("block height exceeded") ||
          msg.includes("Signature expired") ||
          msg.includes("BlockhashNotFound") ||
          msg.includes("expired")

        if (isExpiredBlockhash && attempt < MAX_RETRIES) {
          console.warn(`[Solana] Blockhash expired (attempt ${attempt}), retrying with fresh blockhash...`)
          // Piccola pausa prima del retry per dare tempo alla network
          await new Promise((res) => setTimeout(res, 1000))
          continue
        }

        // Errore non recuperabile (es. fondi insufficienti, wallet non valido)
        console.error(`[Solana] Non-retryable error on attempt ${attempt}:`, msg)
        break
      }
    }

    console.error("[Solana] All attempts failed. Last error:", lastError)
    return null
  } catch (error) {
    console.error("[Solana] Fatal attestation error:", error)
    return null
  }
}
