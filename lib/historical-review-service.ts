import { z } from "zod"
import {
  ReviewError, approvalBlockers, approve, assertCurrent, canonical, createChallenge, initialState,
  requireWallet, reviewKey, validateDraft, verifyStoredState,
} from "./historical-review-core"
import type { ReviewSnapshot, ReviewState, ReviewView } from "./historical-review-types"
import type { ReviewStore } from "./historical-review-store"

const base = { reviewKey: z.string().regex(/^[a-f0-9]{64}$/), expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("save"), draft: z.unknown() }).strict(),
  z.object({ ...base, action: z.literal("challenge"), wallet: z.string().max(100) }).strict(),
  z.object({ ...base, action: z.literal("approve"), nonce: z.string().uuid(), signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/) }).strict(),
])
export class HistoricalReviewService {
  constructor(private store: ReviewStore, private domain: string, private wallets: string[]) {}
  async state(snapshot: ReviewSnapshot) {
    const state = await this.store.get(reviewKey(snapshot)) ?? initialState(snapshot)
    return verifyStoredState(snapshot, state, this.domain)
  }
  view(snapshot: ReviewSnapshot, state: ReviewState): ReviewView {
    return { snapshot, state, snapshotHash: state.snapshotHash, reviewKey: state.reviewKey,
      blockers: approvalBlockers(snapshot, state.draft), walletReady: this.wallets.length > 0,
      localOnly: process.env.SOLAY39_REVIEW_STORE === "local", readOnly: process.env.SOLAY39_REVIEW_READ_ONLY === "yes" }
  }
  async read(snapshot: ReviewSnapshot) { return this.view(snapshot, await this.state(snapshot)) }
  async execute(snapshot: ReviewSnapshot, raw: unknown) {
    const parsed = commandSchema.safeParse(raw)
    if (!parsed.success) throw new ReviewError("INVALID_COMMAND", "Richiesta non valida.", 400)
    const input = parsed.data
    if (input.reviewKey !== reviewKey(snapshot)) throw new ReviewError("STALE_SNAPSHOT", "Snapshot diverso: ricaricare la revisione.")
    let state = await this.state(snapshot)
    if (input.action === "approve" && state.approval?.nonce === input.nonce && state.approval.signature === input.signature) {
      return this.view(snapshot, state) // Idempotent readback, never a second approval.
    }
    assertCurrent(snapshot, state, input.reviewKey, input.expectedVersion)
    // First write creates a private revision, never a published audit.
    if (!await this.store.get(state.reviewKey)) {
      if (!await this.store.compareAndSwap(state.reviewKey, -1, state)) throw new ReviewError("CONCURRENT_WRITE", "Revisione aperta in un'altra sessione. Ricaricare.")
    }
    let next: ReviewState
    if (input.action === "save") {
      next = { ...state, version: state.version + 1, draft: validateDraft(snapshot, input.draft), challenge: null }
    } else if (input.action === "challenge") {
      next = createChallenge(snapshot, state, requireWallet(input.wallet, this.wallets), this.domain)
    } else {
      next = approve(snapshot, state, input.signature, input.nonce, this.domain, this.wallets)
    }
    if (!await this.store.compareAndSwap(state.reviewKey, state.version, next)) throw new ReviewError("CONCURRENT_WRITE", "Salvataggio concorrente. Nessuna nuova approvazione confermata.")
    const persisted = await this.store.get(state.reviewKey)
    if (!persisted || canonical(persisted) !== canonical(next)) throw new ReviewError("READBACK_FAILED", "Salvataggio non verificabile: ricaricare prima di considerare approvato.", 503)
    state = verifyStoredState(snapshot, persisted, this.domain)
    return this.view(snapshot, state)
  }
}
