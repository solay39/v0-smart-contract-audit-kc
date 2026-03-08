// app/api/solana-attest/route.ts
// Endpoint dedicato per l'attestazione on-chain Solana
// Chiamato dal frontend dopo l'analisi Skynet

import { NextRequest, NextResponse } from "next/server"

// IMPORTANTE: @solana/web3.js richiede il runtime Node.js (non Edge)
export const runtime = "nodejs"
export const maxDuration = 30 // 30s è sufficiente per Solana (3 retry da 8s ciascuno)

export async function POST(req: NextRequest) {
  let body: { auditId?: string; reportHash?: string; ipfsCid?: string } = {}
  
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }
  
  const { auditId, reportHash, ipfsCid } = body
  
  try {

    if (!auditId || !reportHash) {
      return NextResponse.json(
        { success: false, error: "auditId e reportHash sono obbligatori" },
        { status: 400 }
      )
    }

    // Verifica che SOLANA_PRIVATE_KEY sia configurata prima di tentare
    if (!process.env.SOLANA_PRIVATE_KEY) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: "SOLANA_PRIVATE_KEY non configurata nelle variabili d'ambiente di Vercel.",
        instructions: "Vai su Vercel Dashboard → Settings → Environment Variables e aggiungi SOLANA_PRIVATE_KEY con la tua chiave Base58 (esportata da Phantom/Solflare).",
      }, { status: 503 })
    }

    console.log(`[Solana Attest] Starting attestation for auditId: ${auditId}`)

    // Dynamic import per evitare crash a livello di modulo se la lib non è disponibile
    let registerAuditOnSolana: (auditId: string, reportHash: string, ipfsCid?: string) => Promise<unknown>
    try {
      const mod = await import("@/lib/solana-attestation")
      registerAuditOnSolana = mod.registerAuditOnSolana
    } catch (importErr) {
      const importMsg = importErr instanceof Error ? importErr.message : String(importErr)
      console.error("[Solana Attest] Failed to load solana-attestation library:", importMsg)
      return NextResponse.json({
        success: false,
        configured: true,
        error: `Libreria Solana non disponibile: ${importMsg}. Verifica che @solana/web3.js e bs58 siano nelle dipendenze del progetto (package.json).`,
      }, { status: 503 })
    }

    const result = await registerAuditOnSolana(
      auditId,
      reportHash,
      ipfsCid ?? undefined
    )

    if (!result) {
      return NextResponse.json({
        success: false,
        configured: true,
        error: "Attestazione fallita dopo 3 tentativi. Possibili cause: saldo SOL insufficiente, RPC non raggiungibile, o rete congestionata. Riprova tra qualche secondo.",
      }, { status: 500 })
    }

    console.log(`[Solana Attest] ✓ Success: ${result.solscanUrl}`)

    return NextResponse.json({
      success: true,
      configured: true,
      attestation: result,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[Solana Attest] Fatal error:", msg)

    return NextResponse.json({
      success: false,
      configured: !!process.env.SOLANA_PRIVATE_KEY,
      error: `Errore server: ${msg}`,
    }, { status: 500 })
  }
}

// GET: verifica se l'attestazione Solana è configurata
export async function GET() {
  const configured = !!process.env.SOLANA_PRIVATE_KEY
  const rpc = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"
  const network = rpc.includes("devnet") ? "devnet" : "mainnet"

  return NextResponse.json({
    configured,
    network,
    rpc: configured ? rpc.replace(/\/\/.*@/, "//***@") : null, // nasconde credenziali se presenti
    instructions: configured
      ? null
      : "Aggiungi SOLANA_PRIVATE_KEY nelle Environment Variables di Vercel per attivare le attestazioni on-chain.",
  })
}