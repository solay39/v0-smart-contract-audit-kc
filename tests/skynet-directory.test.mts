import { test } from "node:test"
import assert from "node:assert/strict"
import {
  directoryLogo,
  networkCounts,
  normalizeDirectory,
  selectDirectory,
} from "../lib/skynet-directory"

const raw = {
  id: "tagger-1793148483876",
  name: "Tagger",
  ticker: "TAG",
  network: "BSC",
  date: "2026-10-28",
  contractAddress: "0x123456789",
  logoUrl:
    "https://coin-images.coingecko.com/coins/images/53206/large/IMG_3196.png",
  findings: [{ severity: "HIGH" }, { severity: "info" }],
  score: 100,
  rating: "AAA",
}
test("legacy ratings, signatures and private approvals never become public verified ratings", () => {
  const p = normalizeDirectory([
    {
      ...raw,
      reviewStatus: "APPROVED_UNPUBLISHED",
      technicalReview: { signed: true },
    },
  ])[0]
  assert.equal(p.status, "preliminary")
  assert.ok(!("score" in p) && !("rating" in p) && !("technicalReview" in p))
  assert.equal(p.findings, 2)
  assert.equal(p.highFindings, 1)
})
test("records without findings remain unknown, empty findings do not imply safety", () => {
  assert.equal(
    normalizeDirectory([{ ...raw, findings: undefined, highs: 99 }])[0]
      .findings,
    null
  )
  assert.equal(normalizeDirectory([{ ...raw, findings: [] }])[0].findings, 0)
})
test("unsafe IDs, malformed records and duplicates are dropped without merging different reports", () => {
  const records = normalizeDirectory([
    null,
    3,
    {},
    { id: "../bad" },
    { ...raw, id: "x".repeat(201) },
    raw,
    raw,
    { ...raw, id: "tagger-second" },
  ])
  assert.deepEqual(
    records.map((p) => p.id),
    [raw.id, "tagger-second"]
  )
})
test("invalid payload fails instead of being misrepresented as an empty catalog", () => {
  for (const payload of [null, undefined, {}, "bad"])
    assert.throws(() => normalizeDirectory(payload))
})
test("dates come only from declared fields, never report IDs or fetch time", () => {
  assert.equal(
    normalizeDirectory([raw])[0].reportedAt,
    "2026-10-28T00:00:00.000Z"
  )
  for (const value of [
    undefined,
    "",
    "not a date",
    "30/12/2026",
    "2099-99-99",
    "2026-02-30",
  ])
    assert.equal(
      normalizeDirectory([{ ...raw, date: value }])[0].reportedAt,
      null
    )
})
test("logo URL policy permits real token logos, rejects executable and untrusted URLs", () => {
  assert.equal(directoryLogo(raw.logoUrl), raw.logoUrl)
  for (const value of [
    "javascript:alert(1)",
    "data:image/svg+xml,bad",
    "http://coingecko.com/a",
    "https://coingecko.com.evil.test/a",
    "https://user:pass@coingecko.com/a",
    "https://127.0.0.1/a",
    "https://coingecko.com:999/a",
  ])
    assert.equal(directoryLogo(value), null)
})
test("search covers name ticker address and report ID, case-insensitive and whitespace tolerant", () => {
  const records = normalizeDirectory([raw])
  for (const query of ["  TaGgEr  ", "tag", "0X123", "1793148483876"])
    assert.equal(selectDirectory(records, query, "all", "name").length, 1)
  assert.equal(selectDirectory(records, "not-found", "all", "name").length, 0)
  assert.equal(selectDirectory(records, "", "Ethereum", "name").length, 0)
})
test("sorting is deterministic, non-mutating and missing dates/findings sort last", () => {
  const records = normalizeDirectory([
    raw,
    { ...raw, id: "ake", name: "AKE", date: undefined, findings: undefined },
  ])
  assert.equal(selectDirectory(records, "", "all", "name")[0].id, "ake")
  assert.equal(selectDirectory(records, "", "all", "recent")[0].id, raw.id)
  assert.equal(selectDirectory(records, "", "all", "findings")[0].id, raw.id)
  assert.equal(records[0].id, raw.id)
})
test("network counts reconcile to valid public records", () => {
  const records = normalizeDirectory([
    raw,
    { ...raw, id: "aero", network: "Base" },
    { ...raw, id: "tagger2" },
  ])
  assert.deepEqual(networkCounts(records), [
    { network: "BSC", count: 2 },
    { network: "Base", count: 1 },
  ])
})
test("display fields are bounded and HTML is plain text, not executed", () => {
  const p = normalizeDirectory([
    {
      id: "safe",
      name: "<script>alert(1)</script>" + "x".repeat(300),
      network: null,
    },
  ])[0]
  assert.equal(p.name.length, 200)
  assert.equal(p.network, "Not disclosed")
})
test("English fallbacks preserve original project names and preliminary status", () => {
  const missing = normalizeDirectory([{ id: "missing" }])[0]
  assert.equal(missing.name, "Unnamed project")
  assert.equal(missing.network, "Not disclosed")
  assert.equal(missing.status, "preliminary")
  const original = normalizeDirectory([
    { ...raw, name: "Progetto originale" },
  ])[0]
  assert.equal(original.name, "Progetto originale")
  assert.throws(() => normalizeDirectory(null), /Invalid public directory/)
})
