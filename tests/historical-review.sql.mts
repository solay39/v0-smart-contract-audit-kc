// Offline PostgreSQL-compatible QA only; never connect to Supabase.
// tsx tests/historical-review.sql.mts /absolute/path/to/@electric-sql/pglite/dist/index.js
import { promises as fs } from "node:fs"
import assert from "node:assert/strict"
import { digest, initialState } from "../lib/historical-review-core"
import type { ReviewSnapshot } from "../lib/historical-review-types"
const modulePath = process.argv[2]
if (!modulePath || !modulePath.startsWith("/tmp/")) throw new Error("Isolated PGlite module required")
const { PGlite } = await import(modulePath)
const db = new PGlite()
const checks: string[] = []
try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;")
  const migration = await fs.readFile(new URL("../supabase/migrations/202611070001_historical_review_private.sql", import.meta.url), "utf8")
  await db.exec(migration)
  await db.exec(migration) // Intended idempotence without altering existing audit data.
  checks.push("Additive migration executes and is idempotent on isolated PostgreSQL-compatible engine")
  const tables = await db.query("select relname,relrowsecurity from pg_class where relname in ('historical_review_catalogs','historical_review_states')")
  assert.equal(tables.rows.length, 2)
  assert.ok(tables.rows.every((r: any) => r.relrowsecurity))
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`)
    await assert.rejects(db.query("select * from public.historical_review_states"), /permission denied/)
    await assert.rejects(db.query("select * from public.historical_review_catalogs"), /permission denied/)
    await assert.rejects(db.query("insert into public.historical_review_catalogs (digest,document) values ($1,$2)", [digest("synthetic"), {}]), /permission denied/)
    await db.exec("reset role")
  }
  checks.push("RLS enabled and anon/authenticated have no read or write privilege")
  const fixture = {
    schema: "solay39-historical-review-v1", auditId: "SYNTHETIC-SQL-QA", name: "Synthetic SQL fixture", network: "Synthetic",
    address: null, originalReportHash: digest("synthetic"), sourceDigests: [], evidenceHash: digest({ synthetic: true }),
    evidence: { synthetic: true }, refs: [], findings: [], technicalBlockers: ["Synthetic only"], limitations: [], testFixture: true,
  } as ReviewSnapshot
  let state = initialState(fixture)
  await db.exec("set role service_role")
  const key = state.reviewKey
  await db.query("insert into public.historical_review_states (review_key,audit_id,snapshot_hash,version,document) values ($1,$2,$3,$4,$5)",
    [key, state.auditId, state.snapshotHash, 0, state])
  state = { ...state, version: 1 }
  const update = "update public.historical_review_states set version=$1,document=$2 where review_key=$3 and version=$4 returning review_key"
  assert.equal((await db.query(update, [1, state, key, 0])).rows.length, 1)
  assert.equal((await db.query(update, [1, state, key, 0])).rows.length, 0)
  await assert.rejects(db.query(update, [3, { ...state, version: 3 }, key, 1]), /compare-and-swap/)
  checks.push("CAS updates exactly expected version and rejects skipped versions")
  // DB does not verify cryptographic signatures. Server does. These are artificial trigger-only payloads.
  const invalidPublication = { ...state, version: 2, approval: { publication: "PUBLISHED" } }
  await assert.rejects(db.query(update, [2, invalidPublication, key, 1]), /unpublished/)
  const liveNonceApproval = { ...state, version: 2, challenge: { nonce: "synthetic" }, approval: { publication: "UNPUBLISHED" } }
  await assert.rejects(db.query(update, [2, liveNonceApproval, key, 1]), /atomically/)
  const syntheticFrozen = { ...state, version: 2, challenge: null, approval: { publication: "UNPUBLISHED" } }
  await db.query(update, [2, syntheticFrozen, key, 1])
  await assert.rejects(db.query(update, [3, { ...state, version: 3, approval: null }, key, 2]), /frozen/)
  checks.push("Approval must consume nonce and remain unpublished; approved row is frozen")
  await assert.rejects(db.query("delete from public.historical_review_states where review_key=$1", [key]), /permission denied/)
  const pin = digest("synthetic catalog")
  await db.query("insert into public.historical_review_catalogs (digest,document) values ($1,$2)", [pin, { synthetic: true }])
  await assert.rejects(db.query("update public.historical_review_catalogs set document='{}' where digest=$1", [pin]), /permission denied/)
  await db.exec("reset role")
  await assert.rejects(db.query("delete from public.historical_review_states where review_key=$1", [key]), /immutable/)
  await assert.rejects(db.query("update public.historical_review_catalogs set document='{}' where digest=$1", [pin]), /immutable/)
  checks.push("Service role cannot delete history/change catalogs; triggers also protect elevated DB writes")
  const newState = { ...initialState({ ...fixture, auditId: "SYNTHETIC-BAD-INSERT" }), approval: { publication: "UNPUBLISHED" } }
  await assert.rejects(db.query("insert into public.historical_review_states (review_key,audit_id,snapshot_hash,version,document) values ($1,$2,$3,0,$4)",
    [newState.reviewKey, newState.auditId, newState.snapshotHash, newState]), /start unsigned/)
  checks.push("Cannot insert a pre-approved revision")
  assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='public' and tablename='audits'")).rows[0].n, 0)
  checks.push("No public audits table created, read or changed")
  console.log(JSON.stringify({ offlineOnly: true, productionWrites: 0, passed: checks.length, checks }, null, 2))
} finally { await db.close() }
