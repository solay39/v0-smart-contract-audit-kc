import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const [manifestPath = "reports/fork-evidence.json"] = process.argv.slice(2)
const path = resolve(manifestPath)
if (!existsSync(path)) throw new Error(`Fork evidence manifest not found: ${path}`)
const manifest = JSON.parse(readFileSync(path, "utf8"))
if (!manifest.targetCommit || !/^[0-9a-f]{7,40}$/i.test(manifest.targetCommit)) throw new Error("targetCommit must be a Git commit SHA")
if (!manifest.rpcNetwork || !manifest.blockNumber) throw new Error("rpcNetwork and blockNumber are required")
if (!Array.isArray(manifest.pocs) || manifest.pocs.length === 0) throw new Error("At least one PoC result is required")
for (const poc of manifest.pocs) {
  if (!poc.findingId || !poc.command || !["passed", "failed", "not-run"].includes(poc.status)) throw new Error("Each PoC needs findingId, command, and status")
  if (poc.artifactPath) {
    const artifact = resolve(poc.artifactPath)
    if (!existsSync(artifact)) throw new Error(`Missing PoC artifact: ${artifact}`)
    const hash = createHash("sha256").update(readFileSync(artifact)).digest("hex")
    if (poc.sha256 !== hash) throw new Error(`PoC hash mismatch for ${poc.findingId}`)
  }
}
const output = { ...manifest, validatedAt: new Date().toISOString(), manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex") }
writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Validated ${manifest.pocs.length} fork/PoC evidence record(s)`)
