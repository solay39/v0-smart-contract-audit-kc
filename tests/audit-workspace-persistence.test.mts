import { test } from "node:test"
import assert from "node:assert/strict"
import { strToU8, zipSync } from "fflate"
import { normalizeAuditDraft, assertDraftSaved } from "../lib/audit-draft.ts"
import { parseArtifact, verifyCiArtifact } from "../lib/github-analysis-runner.ts"
import { createHash } from "node:crypto"
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
  const clean = parseArtifact({
    "slither.json": strToU8(JSON.stringify({ success: true, error: null, results: {} })),
  })
  assert.equal(clean.slither.success, true)
  assert.equal(clean.slither.findings.length, 0)
})

test("CI evidence must match both its job ID and every artifact hash", () => {
  const file = strToU8('{"success":true,"issues":[]}')
  const files = {
    "mythril.json": file,
    "evidence-manifest.json": strToU8(JSON.stringify({
      job_id: "test-job", source_sha256: "a".repeat(64),
      artifacts: { "mythril.json": createHash("sha256").update(file).digest("hex") },
    })),
  }
  assert.doesNotThrow(() => verifyCiArtifact(files, "test-job"))
  assert.throws(() => verifyCiArtifact(files, "wrong-job"), /not bound/)
  assert.throws(() => verifyCiArtifact({ ...files, "mythril.json": strToU8("changed") }, "test-job"), /integrity failed/)
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
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "BLOB_READ_WRITE_TOKEN", "SOLAY39_FOUNDER_KEY", "GITHUB_FINE_GRAINED_PAT", "GITHUB_TOKEN"]
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  const rows = new Map<string, Record<string, unknown>>()
  try {
    for (const key of keys) delete process.env[key]
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://draft-test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key-not-a-real-credential"
    process.env.SOLAY39_FOUNDER_KEY = "test-founder-key-not-a-real-credential"
    process.env.GITHUB_TOKEN = "test-github-key-not-a-real-credential"
    const jobId = "6eece949-1e36-4a37-9cec-034f14011999"
    const sourceHash = "b".repeat(64)
    const artifactFiles: Record<string, Uint8Array> = {
      "slither.json": strToU8(JSON.stringify({ success: false, error: "fixture compilation failed", results: {} })),
      "mythril.json": strToU8(JSON.stringify({ success: true, issues: [] })),
    }
    artifactFiles["evidence-manifest.json"] = strToU8(JSON.stringify({
      job_id: jobId, source_sha256: sourceHash,
      artifacts: Object.fromEntries(Object.entries(artifactFiles).map(([name, bytes]) => [
        name, createHash("sha256").update(bytes).digest("hex"),
      ])),
    }))
    const archive = zipSync(artifactFiles)
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === "api.github.com") {
        if (url.pathname.endsWith("/runs")) return Response.json({ workflow_runs: [{
          id: 33, name: `static-analysis ${jobId}`, status: "completed", conclusion: "failure",
          html_url: "https://github.com/solay39/v0-smart-contract-audit-kc/actions/runs/33",
        }] })
        if (url.pathname.endsWith("/artifacts")) return Response.json({ artifacts: [{
          name: `static-analysis-${jobId}`, expired: false,
          archive_download_url: "https://api.github.com/repos/solay39/v0-smart-contract-audit-kc/actions/artifacts/44/zip",
        }] })
        if (url.pathname.endsWith("/zip")) return new Response(archive)
        throw new Error(`Unexpected GitHub fixture request: ${url.pathname}`)
      }
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
    const ciDraft = {
      ...draft, id: "test-ci-draft-1794012604049", reportIntegrity: { sourceSha256: sourceHash },
      ciAnalysis: { jobId, runUrl: "https://untrusted.invalid/", result: { slither: { success: true } } },
    }
    const savedCi = await storeAuditDraft(ciDraft)
    assert.equal(savedCi.audit.ciAnalysis?.result.slither.success, false)
    assert.equal(savedCi.audit.ciAnalysis?.result.slither.error, "fixture compilation failed")
    assert.equal(savedCi.audit.ciAnalysis?.runUrl, "https://github.com/solay39/v0-smart-contract-audit-kc/actions/runs/33")
    await assert.rejects(() => storeAuditDraft({
      ...ciDraft, reportIntegrity: { sourceSha256: "c".repeat(64) },
    }), /does not match/)
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
