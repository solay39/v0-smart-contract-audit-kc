import { requireFounder, hasPrivateFounderPassword } from "./founder-auth"
import { allowedWallets, ReviewError, reviewKey, verifyStoredState } from "./historical-review-core"
import { loadReviewCatalog } from "./historical-review-catalog"
import { configuredStore } from "./historical-review-store"
import { HistoricalReviewService } from "./historical-review-service"
import type { ReviewQueueItem } from "./historical-review-types"

export function reviewConfiguration(req: Request) {
  if (process.env.SOLAY39_HISTORICAL_REVIEWS !== "enabled") throw new ReviewError("FEATURE_DISABLED", "Flusso privato non attivato.", 404)
  // No legacy public password fingerprint or derived session secret in this high-assurance flow.
  if (!hasPrivateFounderPassword()
      || (process.env.SOLAY39_SESSION_SECRET?.trim().length ?? 0) < 32) {
    throw new ReviewError("FOUNDER_CONFIGURATION", "Richiesti password founder privata e segreto sessione espliciti.", 503)
  }
  const raw = process.env.SOLAY39_REVIEW_ORIGIN
  let origin: string
  try {
    if (!raw || new URL(raw).origin !== raw) throw new Error()
    origin = new URL(raw).origin
    if ((process.env.NODE_ENV === "production" || process.env.VERCEL) && !origin.startsWith("https://")) throw new Error()
  } catch { throw new ReviewError("ORIGIN_CONFIGURATION", "Origin della revisione non configurato correttamente.", 503) }
  if (!["GET", "HEAD"].includes(req.method) && req.headers.get("origin") !== origin) {
    throw new ReviewError("CROSS_ORIGIN", "Richiesta senza Origin o da un sito non autorizzato.", 403)
  }
  return { origin, wallets: allowedWallets(process.env.SOLAY39_AUDITOR_WALLETS || "") }
}
export function reviewResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Authorization", "X-Content-Type-Options": "nosniff" } })
}
export async function boundedReviewBody(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ReviewError("CONTENT_TYPE", "Richiesto JSON.", 415)
  const max = 2 * 1024 * 1024
  if (Number(req.headers.get("content-length")) > max) throw new ReviewError("BODY_TOO_LARGE", "Richiesta troppo grande.", 413)
  const reader = req.body?.getReader()
  if (!reader) throw new ReviewError("INVALID_BODY", "Richiesta vuota.", 400)
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > max) { await reader.cancel(); throw new ReviewError("BODY_TOO_LARGE", "Richiesta troppo grande.", 413) }
      chunks.push(value)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) }
    catch { throw new ReviewError("INVALID_BODY", "JSON non valido.", 400) }
  } finally { reader.releaseLock() }
}
export async function historicalReviewHandler(req: Request, auditId?: string) {
  const denied = await requireFounder(req)
  if (denied) return reviewResponse({ error: "Accesso founder richiesto.", code: "UNAUTHORIZED" }, 401)
  try {
    const { origin, wallets } = reviewConfiguration(req)
    if (req.method !== "GET" && process.env.SOLAY39_REVIEW_READ_ONLY === "yes") throw new ReviewError("READ_ONLY", "Sessione di sola lettura: nessuna bozza, firma o approvazione può essere salvata.", 403)
    const catalog = await loadReviewCatalog()
    const store = configuredStore()
    if (!auditId) {
      const states = await store.getMany(catalog.snapshots.map(reviewKey))
      const queue: ReviewQueueItem[] = catalog.snapshots.map(snapshot => {
        const key = reviewKey(snapshot)
        const state = states.get(key)
        if (state) verifyStoredState(snapshot, state, origin)
        return { auditId: snapshot.auditId, name: snapshot.name, network: snapshot.network, address: snapshot.address,
          reviewKey: key, technicalBlockers: snapshot.technicalBlockers, findings: snapshot.findings.length,
          status: state?.approval ? "APPROVED_UNPUBLISHED" : state ? "DRAFT" : "NOT_STARTED" }
      })
      return reviewResponse({ queue, publication: "UNPUBLISHED", localOnly: process.env.SOLAY39_REVIEW_STORE === "local" })
    }
    const snapshot = catalog.snapshots.find(s => s.auditId === auditId)
    if (!snapshot) throw new ReviewError("NOT_FOUND", "Audit non presente nel catalogo verificato.", 404)
    const service = new HistoricalReviewService(store, origin, wallets)
    const view = req.method === "GET" ? await service.read(snapshot) : await service.execute(snapshot, await boundedReviewBody(req))
    return reviewResponse(view)
  } catch (error) {
    if (error instanceof ReviewError) return reviewResponse({ error: error.message, code: error.code }, error.status)
    console.error("[historical-review] internal failure", error instanceof Error ? error.name : "unknown")
    return reviewResponse({ error: "Archivio o configurazione non disponibile. Nessuna approvazione confermata.", code: "UNAVAILABLE" }, 503)
  }
}
