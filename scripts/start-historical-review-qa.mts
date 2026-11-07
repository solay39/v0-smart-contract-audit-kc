/**
 * Isolated local browser QA. Synthetic reports and ephemeral wallet ONLY.
 * Does not copy user credentials, use real data or contact production storage.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { spawn, execFileSync } from "node:child_process"
import { Wallet } from "ethers"
import { digest, canonical } from "../lib/historical-review-core"
import type { ReviewSnapshot } from "../lib/historical-review-types"

const port = process.argv[2] || "3001"
const readOnlyCatalog = process.argv[3]
if (readOnlyCatalog && !path.resolve(readOnlyCatalog).startsWith(path.resolve(".local") + path.sep)) throw new Error("Local private catalog required")
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid local port")
await fs.mkdir(".local", { recursive: true, mode: 0o700 })
const root = await fs.mkdtemp(path.resolve(".local/historical-review-qa-"))
const wallet = Wallet.createRandom()
const password = "synthetic-qa-" + randomUUID()
// Exercise the actual Secure/SameSite=None founder cookie over local TLS.
const keyFile = path.join(root, "localhost-key.pem")
const certFile = path.join(root, "localhost-cert.pem")
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyFile,
  "-out", certFile, "-days", "1", "-subj", "/CN=127.0.0.1",
  "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"], { stdio: "ignore" })
await fs.chmod(keyFile, 0o600)
const fixture: ReviewSnapshot = {
  schema: "solay39-historical-review-v1", auditId: "synthetic-qa-only", name: "Synthetic QA fixture",
  network: "Ethereum", address: "0x0000000000000000000000000000000000000001",
  originalReportHash: digest("synthetic report"), sourceDigests: [{ target: "qa-only", sha256: digest("synthetic source") }],
  evidenceHash: digest({ synthetic: true }), evidence: { synthetic: true },
  refs: [{ sha256: digest("synthetic source"), label: "SYNTHETIC SOURCE FIXTURE" }],
  findings: [{ id: digest("synthetic finding"), kind: "historical", title: "Synthetic finding for QA", declaredSeverity: "UNRATED",
    description: "Synthetic fixture. No real security conclusion. <script>Never execute finding HTML</script>", sourceTarget: "qa-only" }],
  technicalBlockers: [], limitations: ["SYNTHETIC TEST ONLY. Never use as a real audit opinion."], testFixture: true,
}
const syntheticCatalog = { schema: "solay39-historical-catalog-v1", dossierSha256: digest("synthetic archive"), snapshots: [
  fixture,
  { ...fixture, auditId: "synthetic-blocked-qa-only", name: "Synthetic blocked record", technicalBlockers: ["SYNTHETIC: runtime binding missing; checklist cannot bypass this blocker."] },
  { ...fixture, auditId: "synthetic-long-id-".repeat(7), name: "Synthetic long identifier record" },
] }
const catalog = readOnlyCatalog ? JSON.parse(await fs.readFile(readOnlyCatalog, "utf8")) : syntheticCatalog
await fs.writeFile(path.join(root, "catalog.json"), canonical(catalog), { mode: 0o600 })
await fs.writeFile(path.join(root, "synthetic-credentials.json"), JSON.stringify({ password, email: "synthetic-founder@example.invalid",
  walletAddress: wallet.address, walletPrivateKey: wallet.privateKey }), { mode: 0o600 })
const env: NodeJS.ProcessEnv = { NODE_ENV: "development" }
for (const key of ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "TMP", "TEMP", "NODE_PATH", "PNPM_HOME", "XDG_CACHE_HOME"]) {
  if (process.env[key]) env[key] = process.env[key]
}
Object.assign(env, {
  NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1",
  // Explicit empty values also override any existing dotenv production credentials.
  NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "",
  BLOB_READ_WRITE_TOKEN: "", SOLAY39_FOUNDER_KEY: "",
  SOLAY39_HISTORICAL_REVIEWS: "enabled", SOLAY39_FOUNDER_EMAIL: "synthetic-founder@example.invalid",
  SOLAY39_FOUNDER_PASSWORD_SHA256: digestPassword(password), SOLAY39_SESSION_SECRET: randomUUID() + randomUUID(),
  SOLAY39_REVIEW_STORE: "local", SOLAY39_REVIEW_LOCAL_DIR: path.join(root, "states"),
  SOLAY39_REVIEW_ORIGIN: `https://127.0.0.1:${port}`,
  SOLAY39_REVIEW_CATALOG_FILE: path.join(root, "catalog.json"), SOLAY39_REVIEW_CATALOG_SHA256: digest(catalog),
  SOLAY39_AUDITOR_WALLETS: wallet.address,
  SOLAY39_REVIEW_READ_ONLY: readOnlyCatalog ? "yes" : "",
})
function digestPassword(value: string) {
  // Password fingerprint is bytes SHA-256, not the canonical JSON content digest.
  return createHash("sha256").update(value).digest("hex")
}
import { createHash } from "node:crypto"
console.log(`SYNTHETIC_QA_ROOT=${root}`)
console.log(readOnlyCatalog ? "LOCAL READ-ONLY CATALOG QA. Writes disabled. No historical approvals." : "LOCAL SYNTHETIC QA ONLY. No historical approvals.")
const child = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", port,
  "--experimental-https", "--experimental-https-key", keyFile, "--experimental-https-cert", certFile],
  { stdio: "inherit", env })
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal))
child.on("exit", code => process.exit(code ?? 1))
