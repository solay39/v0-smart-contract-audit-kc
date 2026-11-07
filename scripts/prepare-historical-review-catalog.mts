/**
 * OFFLINE ONLY. Verify the previously delivered archive and every listed file.
 * Generate a private, unsigned queue; never contact a database or publish.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { parseArgs } from "node:util"
import { createHash } from "node:crypto"
import { byteDigest, canonical, digest } from "../lib/historical-review-core"
import { parseEvidenceJson } from "../lib/historical-review-json"
import { validateCatalog, type ReviewCatalog } from "../lib/historical-review-catalog"
import type { ReviewFinding, ReviewSnapshot } from "../lib/historical-review-types"

const { values } = parseArgs({ options: {
  "dossier-dir": { type: "string" }, archive: { type: "string" },
  "archive-sha256": { type: "string" }, output: { type: "string" },
} })
if (!values["dossier-dir"] || !values.archive || !values["archive-sha256"] || !values.output) {
  throw new Error("Usage: tsx scripts/prepare-historical-review-catalog.mts --dossier-dir DIR --archive FILE --archive-sha256 SHA256 --output PRIVATE_FILE")
}
const root = await fs.realpath(values["dossier-dir"])
const archiveHash = byteDigest(await fs.readFile(values.archive))
if (archiveHash !== values["archive-sha256"] || !/^[a-f0-9]{64}$/.test(archiveHash)) throw new Error("Archive SHA-256 mismatch")
const manifest = execFileSync("tar", ["-xOf", path.resolve(values.archive), "./SHA256SUMS"], { encoding: "utf8", maxBuffer: 2_000_000 })
const files = new Map<string, string>()
for (const line of manifest.trim().split("\n")) {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line)
  if (!match || path.isAbsolute(match[2]) || match[2].split("/").some(p => p === ".." || p === ".")) throw new Error("Invalid manifest entry")
  if (files.has(match[2])) throw new Error("Duplicate manifest entry")
  const resolved = await fs.realpath(path.join(root, match[2]))
  if (!resolved.startsWith(root + path.sep) || byteDigest(await fs.readFile(resolved)) !== match[1]) throw new Error(`Artifact mismatch: ${match[2]}`)
  files.set(match[2], match[1])
}
async function json(relative: string): Promise<any> {
  if (!files.has(relative)) throw new Error(`Unbound input: ${relative}`)
  // Re-read/re-hash, not just a path previously checked.
  const bytes = await fs.readFile(path.join(root, relative))
  if (byteDigest(bytes) !== files.get(relative)) throw new Error(`Changed artifact: ${relative}`)
  return parseEvidenceJson(bytes.toString("utf8"))
}
const backup = await json("historical-audits-backup.json")
const registry = await json("risultati/registro-115-audit.json")
const integrity = await json("risultati/risultati-e-integrita.json")
if (integrity.integrity.status !== "PASSED" || backup.length !== 115 || registry.length !== 115) throw new Error("Historical dossier is incomplete")
const compilerList = await json("historical-compiler-evidence/manifest.json")
const staticList = await json("historical-compiler-evidence/static-manifest.json")
const runtimeList = await json("historical-compiler-evidence/runtime-manifest.json")
const chainList = await json("historical-compiler-evidence/chain-manifest.json")
const legacy = await json("historical-compiler-evidence/legacy-review.json")
const secondary = await json("historical-compiler-evidence/secondary-rpc-manifest.json")
const networks: Record<string, number> = { Ethereum: 1, BSC: 56, Base: 8453 }
const compilers = new Map<string, any>(compilerList.map((r: any) => [r.bundle.replace(/\.json$/, ""), r]))
const statics = new Map<string, any>(staticList.map((r: any) => [r.bundle.replace(/\.json$/, ""), r]))
const runtimes = new Map<string, any>(runtimeList.map((r: any) => [r.bundle.replace(/\.json$/, ""), r]))
const chains = new Map<string, any>(chainList.map((r: any) => [`${networks[r.network]}-${r.address.toLowerCase()}`, r]))
const catalog: ReviewCatalog = { schema: "solay39-historical-catalog-v1", dossierSha256: archiveHash, snapshots: [] }
const rawCandidates = new Map<string, any[]>()
const bundles = new Map<string, any>()
for (const [target, summary] of compilers) {
  const bundle = await json(`historical-source-bundles/${target}.json`)
  const sourceHash = createHash("sha256").update("solay39-source-bundle-v1\n")
  for (const filename of Object.keys(bundle.files).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))) {
    const file = bundle.files[filename]
    const actual = byteDigest(Buffer.from(file.content, "utf8"))
    if (actual !== file.sha256) throw new Error(`Source file digest mismatch: ${target}/${filename}`)
    sourceHash.update(filename + "\0" + actual + "\n")
  }
  if (sourceHash.digest("hex") !== summary.sourceManifestSha256) throw new Error(`Source manifest mismatch: ${target}`)
  bundles.set(target, bundle)
  const output = await json(`historical-compiler-evidence/${target}/slither-output.json`)
  if (output.success !== true || !Array.isArray(output.results?.detectors)) throw new Error(`Incomplete Slither output: ${target}`)
  rawCandidates.set(target, output.results.detectors)
}
for (const record of backup) {
  const row = registry.find((r: any) => r.id === record.id)
  if (!row || catalog.snapshots.some(s => s.auditId === record.id)) throw new Error("Missing/duplicate historical ID")
  const deployment = chains.get(row.target)
  const targetSet = new Set<string>(compilers.has(row.target) ? [row.target] : [])
  for (const implementation of deployment?.capturedImplementations ?? []) {
    const address = typeof implementation === "string" ? implementation : implementation.address
    if (address) targetSet.add(`${networks[record.network]}-${address.toLowerCase()}`)
  }
  const targets = [...targetSet].sort()
  const blockers: string[] = []
  if (!record.contractAddress) blockers.push("Indirizzo originale mancante: confermare il target senza correggere silenziosamente il vecchio report.")
  if (record.network === "Solana") blockers.push("Sono stati acquisiti account mint SPL, non il sorgente e i test di un programma Rust. Audit di programma non approvabile.")
  else if (!deployment || !["EXACT_RUNTIME_MATCH", "RUNTIME_MATCH_WITH_EXPLICIT_EXCLUSIONS"].includes(deployment.bytecodeComparison?.status)) {
    blockers.push("Sorgente e runtime del target dichiarato non sono legati da un confronto valido.")
  }
  if (!targets.length && record.network !== "Solana") blockers.push("Nessun bundle sorgente verificato per il target originale.")
  if (deployment?.resolvedImplementation && deployment.implementationMatchesCapture !== true) blockers.push("Implementazione proxy non legata al sorgente catturato.")
  const failed = Object.entries(deployment?.getters ?? {}).filter(([, v]) => (v as any).status === "CALL_FAILED").map(([name]) => name)
  if (failed.length) blockers.push(`Letture di stato obbligatorie non riuscite: ${failed.join(", ")}. Un errore RPC non è uno zero verificato.`)
  for (const target of targets) {
    if (compilers.get(target)?.status !== "COMPILATION_COMPLETED" || statics.get(target)?.status !== "STATIC_ANALYSIS_COMPLETED") blockers.push(`Build/analisi statica incomplete: ${target}`)
    if (compilers.get(target)?.inventory?.status !== "COMPILER_INVENTORY_RECORDED") blockers.push(`Inventario AST del target non risolto: ${target}`)
    if (!runtimes.get(target)?.tests?.length) blockers.push(`Mancano test specifici eseguiti per ${target}; compilazione e Slither non li sostituiscono.`)
  }
  const findings: ReviewFinding[] = (record.findings ?? []).map((finding: any, index: number) => ({
    id: digest({ kind: "historical", auditId: record.id, index, finding }), kind: "historical", title: finding.title || `Finding ${index + 1}`,
    declaredSeverity: finding.severity || "UNRATED", sourceTarget: row.target || "NOT_BOUND",
    description: canonical({ originalUnvalidatedFinding: finding, verification: legacy.records.find((r: any) => r.id === record.id)?.claims[index] ?? null }),
  }))
  for (const target of targets) {
    for (const [index, candidate] of (rawCandidates.get(target) ?? []).entries()) findings.push({
      id: digest({ kind: "slither", target, index, candidate }), kind: "slither", title: candidate.check || "Slither candidate",
      declaredSeverity: candidate.impact || "UNRATED", sourceTarget: target, description: candidate.description || canonical(candidate),
    })
    for (const test of runtimes.get(target)?.tests ?? []) findings.push({
      id: digest({ kind: "observation", target, test }), kind: "observation", title: `Osservazione eseguita: ${test.name}`,
      declaredSeverity: "UNVALIDATED", sourceTarget: target,
      description: canonical({ test, limitation: runtimes.get(target).scope,
        warning: "Success indica che l'assertion è passata: può dimostrare un comportamento rischioso, non assenza di vulnerabilità." }),
    })
  }
  const targetEvidence = targets.map(target => ({
    target, sourceManifestSha256: compilers.get(target)?.sourceManifestSha256 ?? null,
    compilerVersion: compilers.get(target)?.compilerVersion ?? null, compilerStatus: compilers.get(target)?.status ?? null,
    compilerOutputSha256: compilers.get(target)?.outputSha256 ?? null,
    staticSummary: statics.get(target) ?? null, runtime: runtimes.get(target) ?? null, deployment: chains.get(target) ?? null,
    sourceCapture: bundles.get(target)?.capture ?? null,
  }))
  const roleFile = "historical-compiler-evidence/56-0x208bf3e7da9639f1eaefa2de78c23396b0682025/administrative-role-check.json"
  const roleCheck = targets.includes("56-0x208bf3e7da9639f1eaefa2de78c23396b0682025") ? await json(roleFile) : null
  if (roleCheck) blockers.push("TAG: titolari dei ruoli privilegiati non enumerati completamente; completare l'analisi di autorità e la valutazione di cap e replay prima dell'approvazione.")
  if (roleCheck) findings.push({
    id: digest({ kind: "observation", roleCheck }), kind: "observation", title: "TAG: autorità amministrative osservate al blocco fissato",
    declaredSeverity: "UNVALIDATED", sourceTarget: row.target, description: canonical(roleCheck),
  })
  const evidence = {
    dossierSha256: archiveHash, backupSha256: files.get("historical-audits-backup.json"), originalRegistry: row,
    targets: targetEvidence, roleCheck,
    chainSnapshot: await json("historical-compiler-evidence/chain-snapshots.json"),
    secondaryRpc: secondary.filter((r: any) => r.address === record.contractAddress?.toLowerCase() && r.network === record.network),
    solana: record.network === "Solana" ? { snapshot: await json("historical-compiler-evidence/solana-snapshot.json"), extensions: await json("historical-compiler-evidence/solana-extensions.json") } : null,
  }
  const refs = [...files].filter(([name]) => targets.some(target => name.startsWith(`historical-compiler-evidence/${target}/`) || name === `historical-source-bundles/${target}.json`)
    || name === "historical-compiler-evidence/legacy-review.json"
    || (record.network === "Solana" && name.startsWith("historical-compiler-evidence/solana-"))).map(([label, sha256]) => ({ label, sha256 }))
  const snapshot: ReviewSnapshot = {
    schema: "solay39-historical-review-v1", auditId: record.id, name: record.name, network: record.network,
    address: record.contractAddress || null, originalReportHash: digest(record),
    sourceDigests: targets.filter(t => compilers.has(t)).map(target => ({ target, sha256: compilers.get(target).sourceManifestSha256 })),
    evidenceHash: digest(evidence), evidence, refs, findings, technicalBlockers: [...new Set(blockers)],
    limitations: [
      "Le evidenze descrivono snapshot e blocchi fissati, non lo stato attuale o futuro del protocollo.",
      "Il report storico e le dichiarazioni di esecuzione precedenti non sono validati automaticamente.",
      "Il triage di ogni candidato Slither richiede verifica manuale: non ci sono severità confermate dal solo tool.",
      "Le esclusioni di metadata e immutable non sono un match completo byte per byte o una verifica del costruttore.",
      "Nessuna approvazione è stata attribuita al founder durante l'importazione; nessun rating viene ereditato.",
      row.lacune, ...targets.map(t => runtimes.get(t)?.scope).filter(Boolean),
      ...(roleCheck ? ["TAG: sono stati interrogati ruoli del candidato deployer originale; gli altri titolari di ruolo non sono enumerati. I test locali non provano un exploit pubblico attivo."] : []),
    ], testFixture: false,
  }
  catalog.snapshots.push(snapshot)
}
catalog.snapshots.sort((a, b) => a.name.localeCompare(b.name, "it") || a.auditId.localeCompare(b.auditId))
const pin = digest(catalog)
validateCatalog(catalog, pin)
await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true, mode: 0o700 })
await fs.writeFile(values.output, canonical(catalog), { flag: "wx", mode: 0o600 })
console.log(JSON.stringify({
  records: catalog.snapshots.length, artifactsRehashed: files.size, uniqueStaticCandidates: [...rawCandidates.values()].reduce((n, v) => n + v.length, 0),
  technicalEligible: catalog.snapshots.filter(s => !s.technicalBlockers.length).map(s => s.auditId),
  approvals: 0, publication: "NONE", catalogSha256: pin, file: path.resolve(values.output),
}, null, 2))
