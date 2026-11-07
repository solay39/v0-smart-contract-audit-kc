import { promises as fs } from "node:fs"
import { digest, ReviewError } from "./historical-review-core"
import { privateClient } from "./historical-review-store"
import type { ReviewSnapshot } from "./historical-review-types"

export interface ReviewCatalog { schema: "solay39-historical-catalog-v1"; dossierSha256: string; snapshots: ReviewSnapshot[] }
export function validateCatalog(raw: unknown, expected: string): ReviewCatalog {
  if (!/^[a-f0-9]{64}$/.test(expected) || digest(raw) !== expected) throw new ReviewError("CATALOG_DIGEST", "Catalogo mancante o checksum diverso da quello autorizzato.", 503)
  const catalog = raw as ReviewCatalog
  if (catalog.schema !== "solay39-historical-catalog-v1" || !/^[a-f0-9]{64}$/.test(catalog.dossierSha256)
      || !Array.isArray(catalog.snapshots) || !catalog.snapshots.length || catalog.snapshots.length > 1000) {
    throw new ReviewError("INVALID_CATALOG", "Catalogo non valido.", 503)
  }
  const ids = new Set<string>()
  for (const snapshot of catalog.snapshots) {
    if (snapshot.schema !== "solay39-historical-review-v1" || !/^[\w-]{1,180}$/.test(snapshot.auditId)
        || ids.has(snapshot.auditId) || snapshot.evidenceHash !== digest(snapshot.evidence)
        || !Array.isArray(snapshot.findings) || new Set(snapshot.findings.map(f => f.id)).size !== snapshot.findings.length
        || !snapshot.refs.length || snapshot.refs.some(r => !/^[a-f0-9]{64}$/.test(r.sha256))) {
      throw new ReviewError("INVALID_CATALOG", "Snapshot del catalogo non valido.", 503)
    }
    if ((process.env.NODE_ENV === "production" || process.env.VERCEL) && snapshot.testFixture) {
      throw new ReviewError("TEST_FIXTURE_FORBIDDEN", "Fixture sintetiche vietate in produzione.", 503)
    }
    ids.add(snapshot.auditId)
  }
  return catalog
}
let cached: { pin: string; catalog: ReviewCatalog } | undefined
export async function loadReviewCatalog() {
  const pin = process.env.SOLAY39_REVIEW_CATALOG_SHA256 || ""
  if (cached?.pin === pin) return cached.catalog
  let raw: unknown
  if (process.env.SOLAY39_REVIEW_STORE === "local") {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new ReviewError("LOCAL_STORE_FORBIDDEN", "Catalogo locale vietato in produzione.", 503)
    const filename = process.env.SOLAY39_REVIEW_CATALOG_FILE
    if (!filename) throw new ReviewError("CATALOG_CONFIGURATION", "Catalogo privato non configurato.", 503)
    raw = JSON.parse(await fs.readFile(filename, "utf8"))
  } else {
    const { data, error } = await privateClient().from("historical_review_catalogs").select("document").eq("digest", pin).maybeSingle()
    if (error || !data) throw new ReviewError("CATALOG_UNAVAILABLE", "Catalogo privato non disponibile.", 503)
    raw = data.document
  }
  const catalog = validateCatalog(raw, pin)
  cached = { pin, catalog }
  return catalog
}
