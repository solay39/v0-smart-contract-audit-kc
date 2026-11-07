/**
 * Explicit public projection, never a copy of the private review catalog.
 * Usage: node scripts/export-public-executions.mjs NEW_BATCH_DIR PRIOR_BATCH_DIR
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { createHash } from "node:crypto"
import { resolve, join } from "node:path"
import assert from "node:assert/strict"

const [current, prior] = process.argv.slice(2)
assert(current && prior, "Provide both evidence directories")
const read = p => JSON.parse(readFileSync(p, "utf8"))
const digest = p => createHash("sha256").update(readFileSync(p)).digest("hex")
const verified = read(join(current, "verification-final.json"))
const indexPath = join(current, "execution-evidence-index.json")
const index = read(indexPath)
assert.equal(digest(join(current, "verification-final.json")), index.files["verification-final.json"], "Verified result ledger changed")
const targets = []
function properties(tests) {
  return tests.map(test => {
    assert.equal(test.status, "Success")
    assert(/^(test|invariant_)[A-Za-z0-9_(),\[\]]+$/.test(test.name), "Unexpected test identifier")
    const kind = test.kind || {}
    return {
      name: test.name,
      category: kind.Fuzz ? "fuzz" : kind.Invariant ? "invariant" : "unit",
      status: "passed",
      ...(kind.Fuzz ? { runs: kind.Fuzz.runs } : {}),
      ...(kind.Invariant ? { runs: kind.Invariant.runs, calls: kind.Invariant.calls } : {}),
    }
  })
}
for (const row of verified.rows) {
  const relative = `run-4/${row.target}/forge-results.json`
  const outputSha256 = digest(join(current, relative))
  assert.equal(outputSha256, index.files[relative], "Execution artifact changed")
  const [chain, address] = row.target.split("-")
  assert(/^\d+$/.test(chain) && /^0x[a-f0-9]{40}$/.test(address))
  targets.push({
    chainId: Number(chain), address, batch: "historical-specific",
    sourceManifestSha256: row.sourceManifestSha256,
    executionOutputSha256: outputSha256,
    tests: properties(row.tests),
  })
}
assert.equal(targets.length, verified.targets)
assert.equal(targets.reduce((n, row) => n + row.tests.length, 0), verified.testResults)
const manifest = read(join(prior, "runtime-rerun/runtime-manifest.json"))
for (const row of manifest) {
  assert.equal(row.exitCode, 0)
  const [chain, address] = row.bundle.replace(/\.json$/, "").split("-")
  assert.equal(digest(join(prior, "runtime-rerun", `${chain}-${address}`, "forge-results.json")), row.outputSha256, "Prior execution artifact changed")
  assert(!targets.some(t => t.chainId === Number(chain) && t.address === address))
  targets.push({
    chainId: Number(chain), address, batch: "historical-authorization",
    sourceManifestSha256: row.sourceManifestSha256,
    sourceFileSha256: row.sourceSha256,
    executionOutputSha256: row.outputSha256,
    tests: properties(row.tests),
  })
}
const projection = {
  schema: "solay39-public-execution-summary-v1",
  capturedOn: "2026-11-07",
  assurance: "HISTORICAL_LOCAL_SOURCE_FIXTURES_ONLY",
  evidenceIndexSha256: digest(indexPath),
  specificBatch: {
    targets: verified.targets, testResults: verified.testResults,
    fuzzCases: verified.fuzzCases, invariantCampaigns: verified.invariantCampaigns,
    statefulCalls: verified.statefulCalls,
  },
  targets,
}
const destination = resolve("public/evidence/historical-execution-summary.json")
mkdirSync(resolve("public/evidence"), { recursive: true })
writeFileSync(destination, `${JSON.stringify(projection, null, 2)}\n`)
console.log(`Public projection: ${targets.length} targets; no private review fields exported`)
