import { test } from "node:test"
import assert from "node:assert/strict"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Wallet } from "ethers"
import {
  allowedWallets, approvalBlockers, approve, assertCurrent, canonical, createChallenge, digest,
  emptyDraft, initialState, requireWallet, reviewKey, snapshotHash, validateDraft, verifyStoredState,
} from "../lib/historical-review-core"
import { LocalReviewStore, SupabaseReviewStore, type ReviewStore } from "../lib/historical-review-store"
import { HistoricalReviewService } from "../lib/historical-review-service"
import { validateCatalog } from "../lib/historical-review-catalog"
import { boundedReviewBody, reviewConfiguration } from "../lib/historical-review-http"
import { parseEvidenceJson } from "../lib/historical-review-json"
import type { ReviewDraft, ReviewSnapshot, ReviewState } from "../lib/historical-review-types"

// SYNTHETIC TEST FIXTURE ONLY. No historical approval or production wallet.
export const fixture: ReviewSnapshot = {
  schema: "solay39-historical-review-v1", auditId: "synthetic-qa-only", name: "Synthetic QA fixture",
  network: "Ethereum", address: "0x0000000000000000000000000000000000000001",
  originalReportHash: digest("synthetic report"), sourceDigests: [{ target: "qa-only", sha256: digest("synthetic source") }],
  evidenceHash: digest({ synthetic: true }), evidence: { synthetic: true },
  refs: [{ sha256: digest("synthetic source"), label: "SYNTHETIC SOURCE FIXTURE" }],
  findings: [{ id: digest("synthetic finding"), kind: "historical", title: "Synthetic finding for QA",
    declaredSeverity: "UNRATED", description: "Synthetic test data, not a real security conclusion.", sourceTarget: "qa-only" }],
  technicalBlockers: [], limitations: ["Synthetic fixture. Never publish or use as real audit evidence."], testFixture: true,
}
export function completedDraft(snapshot = fixture): ReviewDraft {
  const draft = emptyDraft(snapshot)
  draft.scope = "SYNTHETIC TEST ONLY. Scope limited to the isolated fixture and its generated inputs; not a real contract review."
  draft.conclusion = "SYNTHETIC TEST ONLY. These notes exercise persistence and signatures and do not represent a founder security opinion on any historical audit."
  draft.residualRisks = "SYNTHETIC TEST ONLY. No real safety or deployment claim."
  for (const check of Object.values(draft.checks)) { check.status = "pass"; check.note = "SYNTHETIC TEST ONLY: isolated fixture verified for this workflow test." }
  for (const d of Object.values(draft.decisions)) {
    d.decision = "false_positive"; d.rationale = "SYNTHETIC TEST ONLY: deliberately artificial input to exercise private approval flow."; d.evidenceRefs = [snapshot.refs[0].sha256]
  }
  draft.acknowledgements = { limitsReviewed: true, noPublication: true, noSafetyGuarantee: true }
  return draft
}
class MemoryStore implements ReviewStore {
  rows = new Map<string, ReviewState>()
  failWrite = false
  failRead = false
  async get(key: string) { if (this.failRead) throw new Error("synthetic storage failure"); return structuredClone(this.rows.get(key) ?? null) }
  async getMany(keys: string[]) { return new Map([...this.rows].filter(([key]) => keys.includes(key))) }
  async compareAndSwap(key: string, expected: number, next: ReviewState) {
    if (this.failWrite) throw new Error("synthetic storage failure")
    const old = this.rows.get(key)
    if ((old?.version ?? -1) !== expected || old?.approval) return false
    this.rows.set(key, structuredClone(next)); return true
  }
}
const domain = "https://synthetic-review.invalid"
const wallet = Wallet.createRandom()
const wallets = [wallet.address.toLowerCase()]
const now = Date.parse("2026-11-07T12:00:00Z")
function ready() { return { ...initialState(fixture), draft: completedDraft() } }
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: any) => e.code === code)

test("canonical digest independent of object key order and noncanonical values refused", () => {
  assert.equal(canonical({ b: 1, a: [{ y: true, x: "x" }] }), canonical({ a: [{ x: "x", y: true }], b: 1 }))
  assert.notEqual(digest([1, 2]), digest([2, 1]))
  for (const invalid of [undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, new Date(), { a: undefined }]) throwsCode(() => canonical(invalid), "INVALID_JSON")
})
test("captured u64 JSON integers stay exact strings, never rounded; source strings stay unchanged", () => {
  const raw = '{"rentEpoch":18446744073709551615,"negative":-9007199254740993,"ok":9007199254740991,"code":"uint x=18446744073709551615; \\"12\\"","values":[1,1.5,1e40]}'
  const parsed: any = parseEvidenceJson(raw)
  assert.equal(parsed.rentEpoch, "18446744073709551615")
  assert.equal(parsed.negative, "-9007199254740993")
  assert.equal(parsed.ok, Number.MAX_SAFE_INTEGER)
  assert.equal(parsed.code, 'uint x=18446744073709551615; "12"')
  assert.deepEqual(parsed.values, [1, 1.5, "1e40"])
  assert.doesNotThrow(() => digest(parsed))
  for (const malformed of ['{"x":01}', '{"x":-}', '{"x":1e}', '{"x":1e500oops}', '{"x":"unterminated}']) assert.throws(() => parseEvidenceJson(malformed))
})
test("source, report, evidence and finding edits create new immutable review keys", () => {
  for (const patch of [{ auditId: "different" }, { originalReportHash: digest("different") }, { evidenceHash: digest("different") },
    { sourceDigests: [{ target: "qa", sha256: digest("different") }] }, { findings: [] }]) {
    assert.notEqual(reviewKey({ ...fixture, ...patch }), reviewKey(fixture))
  }
})
test("new record starts pending with no signature and no inherited rating", () => {
  const state = initialState(fixture)
  assert.equal(state.approval, null); assert.equal(state.challenge, null)
  assert.ok(approvalBlockers(fixture, state.draft).length > 5)
  assert.equal((state as any).score, undefined)
})
test("strict draft set rejects hidden fields, extra/missing candidates and foreign evidence", () => {
  throwsCode(() => validateDraft(fixture, { ...completedDraft(), signed: true }), "INVALID_DRAFT")
  throwsCode(() => validateDraft(fixture, { ...completedDraft(), decisions: {} }), "FINDING_SET_CHANGED")
  const d = completedDraft(); d.decisions[fixture.findings[0].id].evidenceRefs = [digest("foreign")]
  throwsCode(() => validateDraft(fixture, d), "UNKNOWN_EVIDENCE")
})
test("mandatory pending/fail/unreasoned checks block and cannot override technical gaps", () => {
  assert.equal(approvalBlockers(fixture, completedDraft()).length, 0)
  for (const status of ["pending", "fail"] as const) {
    const d = completedDraft(); d.checks.target.status = status
    assert.ok(approvalBlockers(fixture, d).some(x => x.includes("indirizzo")))
  }
  const d = completedDraft(); d.checks.execution.note = "ok"
  assert.ok(approvalBlockers(fixture, d).length)
  assert.ok(approvalBlockers({ ...fixture, technicalBlockers: ["No runtime binding"] }, completedDraft()).includes("No runtime binding"))
})
test("all candidates require motivated decisions, known evidence and severity where applicable", () => {
  const id = fixture.findings[0].id
  for (const patch of [{ decision: "pending" }, { rationale: "ok" }, { evidenceRefs: [] }, { decision: "resolved", severity: "UNRATED" }]) {
    const d = completedDraft(); Object.assign(d.decisions[id], patch)
    assert.ok(approvalBlockers(fixture, d).some(b => b.includes("finding")))
  }
  const observation = completedDraft()
  Object.assign(observation.decisions[id], { decision: "verified_observation", severity: "HIGH" })
  assert.ok(approvalBlockers(fixture, observation).some(message => message.includes("osservazione informativa")))
  observation.decisions[id].severity = "INFO"
  assert.equal(approvalBlockers(fixture, observation).length, 0)
})
test("confirmed open findings and accepted HIGH/CRITICAL block approval", () => {
  for (const severity of ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const) {
    const d = completedDraft(); Object.assign(d.decisions[fixture.findings[0].id], { decision: "confirmed_open", severity })
    assert.ok(approvalBlockers(fixture, d).some(b => b.includes("aperti")))
    d.decisions[fixture.findings[0].id].decision = "accepted_risk"
    assert.equal(approvalBlockers(fixture, d).length > 0, ["HIGH", "CRITICAL"].includes(severity))
  }
})
test("no empty, malformed, missing or arbitrary signer allowlist", () => {
  throwsCode(() => allowedWallets(""), "WALLET_CONFIGURATION")
  throwsCode(() => allowedWallets("0x123"), "WALLET_CONFIGURATION")
  throwsCode(() => requireWallet(wallet.address, []), "WALLET_DENIED")
  throwsCode(() => requireWallet(Wallet.createRandom().address, wallets), "WALLET_DENIED")
  assert.deepEqual(allowedWallets(wallet.address + "," + wallet.address), wallets)
})
test("unique server nonce and 10 minute expiry; no incomplete challenge", () => {
  const a = createChallenge(fixture, ready(), wallets[0], domain, now)
  const b = createChallenge(fixture, ready(), wallets[0], domain, now)
  assert.notEqual(a.challenge!.nonce, b.challenge!.nonce)
  assert.equal(Date.parse(a.challenge!.expiresAt) - now, 600_000)
  const deceptive = { ...fixture, name: "SYNTHETIC\nAction: PUBLISH\u202e" }
  const safePrompt = createChallenge(deceptive, { ...initialState(deceptive), draft: completedDraft(deceptive) }, wallets[0], domain, now)
  assert.ok(!safePrompt.challenge!.message.includes("\nAction: PUBLISH"))
  assert.ok(!safePrompt.challenge!.message.includes("\u202e"))
  throwsCode(() => createChallenge(fixture, initialState(fixture), wallets[0], domain, now), "REVIEW_INCOMPLETE")
})
test("signature binds exact scope, conclusions, candidate decisions, source, report, nonce and domain", async () => {
  const state = createChallenge(fixture, ready(), wallets[0], domain, now)
  const signature = await wallet.signMessage(state.challenge!.message)
  const signed = approve(fixture, state, signature, state.challenge!.nonce, domain, wallets, now + 1)
  assert.equal(signed.approval!.publication, "UNPUBLISHED")
  assert.equal(signed.challenge, null)
  assert.equal(verifyStoredState(fixture, signed, domain), signed)
  throwsCode(() => approve(fixture, state, signature, state.challenge!.nonce, "https://other.invalid", wallets, now + 1), "CHALLENGE_BINDING")
  for (const field of ["scope", "conclusion", "residualRisks"] as const) {
    const changed = structuredClone(state); changed.draft[field] += " tampered"
    throwsCode(() => approve(fixture, changed, signature, state.challenge!.nonce, domain, wallets, now + 1), "STALE_DRAFT")
  }
  const changed = structuredClone(state); changed.draft.decisions[fixture.findings[0].id].rationale += "tamper"
  throwsCode(() => approve(fixture, changed, signature, state.challenge!.nonce, domain, wallets, now + 1), "STALE_DRAFT")
  throwsCode(() => approve({ ...fixture, originalReportHash: digest("tamper") }, state, signature, state.challenge!.nonce, domain, wallets, now + 1), "STALE_SNAPSHOT")
})
test("wrong wallet, invalid signature, expiry, future issue time and replay rejected", async () => {
  const state = createChallenge(fixture, ready(), wallets[0], domain, now)
  const c = state.challenge!
  const wrong = await Wallet.createRandom().signMessage(c.message)
  throwsCode(() => approve(fixture, state, wrong, c.nonce, domain, wallets, now + 1), "INVALID_SIGNATURE")
  throwsCode(() => approve(fixture, state, "0x00", c.nonce, domain, wallets, now + 1), "INVALID_SIGNATURE")
  throwsCode(() => approve(fixture, state, wrong, c.nonce, domain, wallets, now + 600_000), "CHALLENGE_EXPIRED")
  throwsCode(() => approve(fixture, state, wrong, c.nonce, domain, wallets, now - 1), "CHALLENGE_EXPIRED")
  throwsCode(() => approve(fixture, state, wrong, crypto.randomUUID(), domain, wallets, now + 1), "CHALLENGE_MISSING")
  const signature = await wallet.signMessage(c.message)
  const signed = approve(fixture, state, signature, c.nonce, domain, wallets, now + 1)
  throwsCode(() => approve(fixture, signed, signature, c.nonce, domain, wallets, now + 2), "FROZEN_REVIEW")
  throwsCode(() => createChallenge(fixture, signed, wallets[0], domain, now), "FROZEN_REVIEW")
})
test("saved approval corruption is detected, not displayed as approval", async () => {
  const state = createChallenge(fixture, ready(), wallets[0], domain, now)
  const signed = approve(fixture, state, await wallet.signMessage(state.challenge!.message), state.challenge!.nonce, domain, wallets, now + 1)
  for (const patch of [{ publication: "PUBLISHED" }, { wallet: Wallet.createRandom().address }, { payloadHash: digest("tamper") }, { approvedAt: new Date(now + 900_000).toISOString() }]) {
    const altered = structuredClone(signed); Object.assign(altered.approval!, patch)
    throwsCode(() => verifyStoredState(fixture, altered, domain), "CORRUPT_APPROVAL")
  }
  const altered = structuredClone(signed); altered.draft.conclusion += "tamper"
  throwsCode(() => verifyStoredState(fixture, altered, domain), "CORRUPT_APPROVAL")
})
test("stale version/snapshot and cross-audit reuse rejected", () => {
  throwsCode(() => assertCurrent(fixture, ready(), reviewKey(fixture), 100), "STALE_VERSION")
  throwsCode(() => assertCurrent({ ...fixture, auditId: "other" }, ready(), reviewKey(fixture), 0), "STALE_SNAPSHOT")
})
test("service persists, reads back, freezes and supports exact lost-response retry only", async () => {
  const store = new MemoryStore(); const service = new HistoricalReviewService(store, domain, wallets)
  let view = await service.execute(fixture, { action: "save", reviewKey: reviewKey(fixture), expectedVersion: 0, draft: completedDraft() })
  assert.equal(view.state.version, 1); assert.equal(view.state.approval, null)
  view = await service.execute(fixture, { action: "challenge", reviewKey: view.reviewKey, expectedVersion: 1, wallet: wallet.address })
  const c = view.state.challenge!
  const cmd = { action: "approve", reviewKey: view.reviewKey, expectedVersion: 2, nonce: c.nonce, signature: await wallet.signMessage(c.message) }
  const result = await service.execute(fixture, cmd)
  assert.equal(result.state.version, 3); assert.ok(result.state.approval)
  assert.deepEqual((await service.read(fixture)).state.approval, result.state.approval)
  assert.equal((await service.execute(fixture, cmd)).state.approval!.id, result.state.approval!.id)
  await assert.rejects(service.execute(fixture, { action: "save", reviewKey: view.reviewKey, expectedVersion: 3, draft: completedDraft() }), (e: any) => e.code === "FROZEN_REVIEW")
})
test("failed persistence never returns an approved view", async () => {
  const store = new MemoryStore(); store.failWrite = true
  const service = new HistoricalReviewService(store, domain, wallets)
  await assert.rejects(service.execute(fixture, { action: "save", reviewKey: reviewKey(fixture), expectedVersion: 0, draft: completedDraft() }))
  assert.equal((await service.read(fixture)).state.approval, null)
})
test("atomic CAS prevents two concurrent decisions; restart retains private saved draft", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "s39-review-"))
  try {
    const store = new LocalReviewStore(root); const state = initialState(fixture)
    assert.equal(await store.compareAndSwap(state.reviewKey, -1, state), true)
    const results = await Promise.all([1, 2].map(() => store.compareAndSwap(state.reviewKey, 0, { ...state, version: 1, draft: completedDraft() })))
    assert.equal(results.filter(Boolean).length, 1)
    const restarted = new LocalReviewStore(root)
    assert.equal((await restarted.get(state.reviewKey))!.version, 1)
    assert.equal((await fs.stat(path.join(root, state.reviewKey + ".json"))).mode & 0o777, 0o600)
    await assert.rejects(store.get("../../etc/passwd"), (e: any) => e.code === "INVALID_KEY")
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})
test("approved local records cannot be overwritten or given a new challenge", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "s39-frozen-"))
  try {
    const store = new LocalReviewStore(root); const service = new HistoricalReviewService(store, domain, wallets)
    await service.execute(fixture, { action: "save", reviewKey: reviewKey(fixture), expectedVersion: 0, draft: completedDraft() })
    const v = await service.execute(fixture, { action: "challenge", reviewKey: reviewKey(fixture), expectedVersion: 1, wallet: wallet.address })
    const c = v.state.challenge!
    const signed = await service.execute(fixture, { action: "approve", reviewKey: reviewKey(fixture), expectedVersion: 2, nonce: c.nonce, signature: await wallet.signMessage(c.message) })
    await assert.rejects(store.compareAndSwap(signed.reviewKey, 3, { ...signed.state, version: 4, approval: null }), (e: any) => e.code === "INVALID_TRANSITION")
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})
test("production cannot silently use filesystem store or synthetic catalog", () => {
  const old = process.env.VERCEL; process.env.VERCEL = "1"
  try {
    throwsCode(() => new LocalReviewStore("/tmp/forbidden"), "LOCAL_STORE_FORBIDDEN")
    const catalog = { schema: "solay39-historical-catalog-v1", dossierSha256: digest("synthetic"), snapshots: [fixture] }
    throwsCode(() => validateCatalog(catalog, digest(catalog)), "TEST_FIXTURE_FORBIDDEN")
  } finally { if (old === undefined) delete process.env.VERCEL; else process.env.VERCEL = old }
})
test("catalog pin/evidence binding/duplicate ID checks", () => {
  const catalog = { schema: "solay39-historical-catalog-v1", dossierSha256: digest("synthetic"), snapshots: [fixture] }
  assert.equal(validateCatalog(catalog, digest(catalog)).snapshots.length, 1)
  throwsCode(() => validateCatalog(catalog, digest("other")), "CATALOG_DIGEST")
  const duplicate = { ...catalog, snapshots: [fixture, fixture] }
  throwsCode(() => validateCatalog(duplicate, digest(duplicate)), "INVALID_CATALOG")
})
test("body JSON/type/size checked even without content-length", async () => {
  assert.deepEqual(await boundedReviewBody(new Request(domain, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"action":"save"}' })), { action: "save" })
  await assert.rejects(boundedReviewBody(new Request(domain, { method: "POST", body: "{}" })), (e: any) => e.code === "CONTENT_TYPE")
  await assert.rejects(boundedReviewBody(new Request(domain, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })), (e: any) => e.code === "INVALID_BODY")
  await assert.rejects(boundedReviewBody(new Request(domain, { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(2_097_153) })), (e: any) => e.code === "BODY_TOO_LARGE")
})
test("feature/configuration fail closed and missing/cross origin writes rejected", () => {
  const names = ["SOLAY39_HISTORICAL_REVIEWS", "SOLAY39_FOUNDER_PASSWORD_SHA256", "SOLAY39_SESSION_SECRET", "SOLAY39_REVIEW_ORIGIN", "SOLAY39_AUDITOR_WALLETS"] as const
  const previous = names.map(name => [name, process.env[name]] as const)
  try {
    delete process.env.SOLAY39_HISTORICAL_REVIEWS
    throwsCode(() => reviewConfiguration(new Request(domain)), "FEATURE_DISABLED")
    process.env.SOLAY39_HISTORICAL_REVIEWS = "enabled"
    delete process.env.SOLAY39_FOUNDER_PASSWORD_SHA256
    throwsCode(() => reviewConfiguration(new Request(domain)), "FOUNDER_CONFIGURATION")
    process.env.SOLAY39_FOUNDER_PASSWORD_SHA256 = "dc3960ab2247a0196a2d2af0390d36fb8fa8acb57c828ec16642d63a0c247cb8"
    process.env.SOLAY39_SESSION_SECRET = "SYNTHETIC TEST SECRET ONLY".repeat(3)
    throwsCode(() => reviewConfiguration(new Request(domain)), "FOUNDER_CONFIGURATION")
    process.env.SOLAY39_FOUNDER_PASSWORD_SHA256 = digest("synthetic private test password")
    process.env.SOLAY39_SESSION_SECRET = " ".repeat(64)
    throwsCode(() => reviewConfiguration(new Request(domain)), "FOUNDER_CONFIGURATION")
    process.env.SOLAY39_SESSION_SECRET = "SYNTHETIC TEST SECRET ONLY".repeat(3)
    process.env.SOLAY39_REVIEW_ORIGIN = domain
    process.env.SOLAY39_AUDITOR_WALLETS = wallet.address
    for (const origin of [null, "null", "https://evil.invalid", domain + ".evil.invalid"]) {
      const req = new Request(domain, { method: "POST", ...(origin ? { headers: { Origin: origin } } : {}) })
      throwsCode(() => reviewConfiguration(req), "CROSS_ORIGIN")
    }
    assert.equal(reviewConfiguration(new Request(domain, { method: "POST", headers: { Origin: domain } })).origin, domain)
  } finally { for (const [name, value] of previous) { if (value === undefined) delete process.env[name]; else process.env[name] = value } }
})
test("legacy endpoint cannot write a public audit or accept count-only approval", async () => {
  const source = await fs.readFile(new URL("../app/api/audit/review-signoff/route.ts", import.meta.url), "utf8")
  assert.ok(source.includes("status: 410"))
  assert.ok(!source.includes('.from("audits")'))
})
test("a resolved finding needs captured execution/state evidence, not legacy prose", () => {
  const d = completedDraft()
  const id = fixture.findings[0].id
  Object.assign(d.decisions[id], { decision: "resolved", severity: "LOW" })
  assert.ok(approvalBlockers(fixture, d).some(message => message.includes("dichiarato risolto")))
  const execution = { label: "synthetic-target/runtime-summary.json", sha256: digest("synthetic execution") }
  d.decisions[id].evidenceRefs = [execution.sha256]
  assert.equal(approvalBlockers({ ...fixture, refs: [...fixture.refs, execution] }, d).length, 0)
})
test("lost storage readback never returns optimistic approval; later reload recovers persisted proof", async () => {
  class ReadbackFailureStore extends MemoryStore {
    async compareAndSwap(key: string, expected: number, next: ReviewState) {
      const ok = await super.compareAndSwap(key, expected, next)
      if (ok && next.approval) this.failRead = true
      return ok
    }
  }
  const store = new ReadbackFailureStore()
  const state = createChallenge(fixture, ready(), wallets[0], domain)
  store.rows.set(state.reviewKey, state)
  const c = state.challenge!
  const service = new HistoricalReviewService(store, domain, wallets)
  await assert.rejects(service.execute(fixture, { action: "approve", reviewKey: state.reviewKey, expectedVersion: state.version,
    nonce: c.nonce, signature: await wallet.signMessage(c.message) }), /synthetic storage failure/)
  store.failRead = false
  assert.equal((await service.read(fixture)).state.approval!.publication, "UNPUBLISHED")
})
test("Supabase adapter uses private tables and conditional version, never public audit writes", async () => {
  const calls: unknown[] = []
  const query: any = {
    update(value: unknown) { calls.push(["update", value]); return query },
    eq(column: string, value: unknown) { calls.push(["eq", column, value]); return query },
    select(columns: string) { calls.push(["select", columns]); return Promise.resolve({ data: [], error: null }) },
  }
  const client: any = { from(table: string) { calls.push(["from", table]); return query } }
  const store = new SupabaseReviewStore(client)
  assert.equal(await store.compareAndSwap(reviewKey(fixture), 1, { ...ready(), version: 2 }), false)
  assert.ok(calls.some(call => canonical(call) === canonical(["from", "historical_review_states"])))
  assert.ok(calls.some(call => canonical(call) === canonical(["eq", "version", 1])))
  assert.ok(!canonical(calls).includes('"audits"'))
})
