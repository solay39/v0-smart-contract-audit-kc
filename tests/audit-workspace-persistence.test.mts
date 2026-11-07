import { test } from "node:test"
import assert from "node:assert/strict"
import { strToU8 } from "fflate"
import { normalizeAuditDraft, assertDraftSaved } from "../lib/audit-draft.ts"
import { parseArtifact } from "../lib/github-analysis-runner.ts"
import { ciFindingsForWorkspace } from "../lib/ci-workspace.ts"
import { GET } from "../app/api/audits/route.ts"
import { storeAuditDraft } from "../lib/audit-draft-storage.ts"

const draft = {
  id: "test-draft-1794012604049", name: "Test draft", network: "Ethereum",
  score: 100, rating: "AAA", findings: [], criticals: 0, highs: 0, mediums: 0,
  lows: 0, infos: 0, date: "2026-11-07",
}

test("draft saving never promotes submitted approvals or ratings", () => {
  const normalized = normalizeAuditDraft({
    ...draft, manualReview: { signatureEth: "unverified" },
    engagement: { reviewTeam: { reviewStatus: "SIGNED", leadAuditor: { signedOff: true } } },
  })
  assert.equal(normalized.score, 0)
  assert.equal(normalized.rating, "PENDING")
  assert.equal(normalized.manualReview, undefined)
  assert.equal(normalized.engagement?.reviewTeam?.reviewStatus, "AUTOMATED_ANALYSIS_PENDING_MANUAL_REVIEW")
  assert.equal(normalized.engagement?.reviewTeam?.leadAuditor.signedOff, false)
})

test("invalid draft identity and malformed findings are rejected", () => {
  for (const value of [null, { ...draft, id: "../bad" }, { ...draft, findings: [{ title: 2 }] }]) {
    assert.throws(() => normalizeAuditDraft(value))
  }
})

test("405, 422 and storage failures cannot produce a publication success or URL", () => {
  for (const status of [405, 422, 503]) {
    assert.throws(() => assertDraftSaved(false, {
      success: true, publicationStatus: "PRELIMINARY", publicUrl: `/audit/${draft.id}`,
    }))
    assert.ok(status >= 400)
  }
  assert.throws(() => assertDraftSaved(true, { success: true }))
  assert.throws(() => assertDraftSaved(true, { success: true, publicationStatus: "PRELIMINARY", publicUrl: "javascript:alert(1)" }))
  assert.equal(assertDraftSaved(true, {
    success: true, publicationStatus: "PRELIMINARY", publicUrl: `/audit/${draft.id}`,
  }), `/audit/${draft.id}`)
})

test("workflow artifacts with missing or failed tool output stay unsuccessful", () => {
  const missing = parseArtifact({})
  assert.equal(missing.slither.success, false)
  assert.equal(missing.mythril.success, false)
  const failed = parseArtifact({
    "slither.json": strToU8(JSON.stringify({ success: false, results: { detectors: [{ check: "partial", elements: [] }] } })),
    "mythril.json": strToU8(JSON.stringify({ success: false, error: "import not found", issues: [] })),
  })
  assert.equal(failed.slither.success, false)
  assert.equal(failed.mythril.success, false)
  assert.equal(failed.mythril.error, "import not found")
})

test("real CI findings map into normal workspace findings with locations", () => {
  const result = parseArtifact({
    "slither.json": strToU8(JSON.stringify({
      success: true, results: { detectors: [{
        check: "reentrancy-eth", impact: "High", confidence: "Medium", description: "External call before state update",
        elements: [{ type: "function", name: "withdraw", source_mapping: { filename_relative: "Vault.sol", lines: [8, 9] } }],
      }] },
    })),
    "mythril.json": strToU8(JSON.stringify({ success: true, issues: [] })),
  })
  const findings = ciFindingsForWorkspace(result)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].severity, "HIGH")
  assert.equal(findings[0].location, "Vault.sol:8,9")
})

test("storage -> canonical GET -> portfolio listing uses one persisted draft, and unavailable storage fails", async () => {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "BLOB_READ_WRITE_TOKEN", "SOLAY39_FOUNDER_KEY"]
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  const rows = new Map<string, Record<string, unknown>>()
  try {
    for (const key of keys) delete process.env[key]
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://draft-test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key-not-a-real-credential"
    process.env.SOLAY39_FOUNDER_KEY = "test-founder-key-not-a-real-credential"
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
      assert.equal(url.hostname, "draft-test.supabase.co")
      if (init?.method === "POST") {
        const row = JSON.parse(String(init.body))
        rows.set(row.id, row)
        return new Response(null, { status: 201 })
      }
      const id = url.searchParams.get("id")?.replace(/^eq\./, "")
      return Response.json(id ? rows.has(id) ? [rows.get(id)] : [] : [...rows.values()])
    }
    const saved = await storeAuditDraft(draft)
    assert.equal(saved.storage, "supabase")
    assert.equal(saved.audit.id, draft.id)
    assert.equal(rows.size, 1)
    const read = await GET(new Request(`https://test.local/api/audits?id=${draft.id}`))
    assert.equal((await read.json()).audit.rating, "PENDING")
    const listing = await GET(new Request("https://test.local/api/audits"))
    assert.ok((await listing.json()).audits.some((audit: { id: string }) => audit.id === draft.id))
    globalThis.fetch = async () => { throw new Error("offline") }
    await assert.rejects(() => storeAuditDraft(draft), /save failed/)
  } finally {
    globalThis.fetch = originalFetch
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
})
