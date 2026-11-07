import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { canonical, ReviewError } from "./historical-review-core"
import type { ReviewState } from "./historical-review-types"

export interface ReviewStore {
  get(key: string): Promise<ReviewState | null>
  getMany(keys: string[]): Promise<Map<string, ReviewState>>
  compareAndSwap(key: string, expected: number, next: ReviewState): Promise<boolean>
}
function validKey(key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new ReviewError("INVALID_KEY", "Identificatore revisione non valido.", 400)
}
function transition(old: ReviewState | null, expected: number, next: ReviewState) {
  if ((old?.version ?? -1) !== expected) return false
  if (!old && (next.approval || next.challenge)) throw new ReviewError("INVALID_TRANSITION", "La nuova revisione deve iniziare non firmata.")
  if (next.version !== expected + 1 || (old && (old.snapshotHash !== next.snapshotHash || old.auditId !== next.auditId || old.approval))) {
    throw new ReviewError("INVALID_TRANSITION", "Transizione non consentita.")
  }
  return true
}
/** Single-host, isolated development only. Never a Vercel persistence fallback. */
export class LocalReviewStore implements ReviewStore {
  constructor(private root: string) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new ReviewError("LOCAL_STORE_FORBIDDEN", "Archivio locale vietato in produzione.", 503)
  }
  async get(key: string): Promise<ReviewState | null> {
    validKey(key)
    try { return JSON.parse(await fs.readFile(path.join(this.root, key + ".json"), "utf8")) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error }
  }
  async getMany(keys: string[]) {
    const rows = await Promise.all(keys.map(async key => [key, await this.get(key)] as const))
    return new Map(rows.filter((row): row is readonly [string, ReviewState] => row[1] !== null))
  }
  async compareAndSwap(key: string, expected: number, next: ReviewState) {
    validKey(key)
    if (next.reviewKey !== key) throw new ReviewError("INVALID_KEY", "Record non associato alla chiave.", 400)
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 })
    const lockPath = path.join(this.root, key + ".lock")
    let lock
    try { lock = await fs.open(lockPath, "wx", 0o600) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return false; throw error }
    const temp = path.join(this.root, key + "." + randomUUID() + ".tmp")
    try {
      if (!transition(await this.get(key), expected, next)) return false
      const file = await fs.open(temp, "wx", 0o600)
      try { await file.writeFile(canonical(next)); await file.sync() } finally { await file.close() }
      await fs.rename(temp, path.join(this.root, key + ".json"))
      const directory = await fs.open(this.root, "r")
      try { await directory.sync() } finally { await directory.close() }
      return true
    } finally {
      await fs.unlink(temp).catch(() => {})
      await lock.close()
      await fs.unlink(lockPath)
    }
  }
}
export class SupabaseReviewStore implements ReviewStore {
  constructor(private client: SupabaseClient) {}
  async get(key: string): Promise<ReviewState | null> {
    validKey(key)
    const { data, error } = await this.client.from("historical_review_states").select("document").eq("review_key", key).maybeSingle()
    if (error) throw new ReviewError("STORE_UNAVAILABLE", "Archivio privato non disponibile. Nessuna conferma di salvataggio.", 503)
    return data?.document ?? null
  }
  async getMany(keys: string[]) {
    const result = new Map<string, ReviewState>()
    for (let i = 0; i < keys.length; i += 40) {
      const chunk = keys.slice(i, i + 40)
      chunk.forEach(validKey)
      const { data, error } = await this.client.from("historical_review_states").select("review_key,document").in("review_key", chunk)
      if (error) throw new ReviewError("STORE_UNAVAILABLE", "Archivio privato non disponibile.", 503)
      for (const row of data ?? []) result.set(row.review_key, row.document)
    }
    return result
  }
  async compareAndSwap(key: string, expected: number, next: ReviewState) {
    validKey(key)
    if (next.reviewKey !== key || next.version !== expected + 1) throw new ReviewError("INVALID_TRANSITION", "Versione non valida.", 400)
    if (expected === -1) {
      const { error } = await this.client.from("historical_review_states").insert({
        review_key: key, audit_id: next.auditId, snapshot_hash: next.snapshotHash, version: 0, document: next,
      })
      if (error?.code === "23505") return false
      if (error) throw new ReviewError("STORE_UNAVAILABLE", "Impossibile creare la revisione privata.", 503)
      return true
    }
    const { data, error } = await this.client.from("historical_review_states")
      .update({ version: next.version, document: next }).eq("review_key", key).eq("version", expected).select("review_key")
    if (error) throw new ReviewError("STORE_UNAVAILABLE", "Salvataggio non confermato dall'archivio privato.", 503)
    return data?.length === 1
  }
}
export function privateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new ReviewError("STORE_CONFIGURATION", "Configurazione archivio privato mancante.", 503)
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
export function configuredStore(): ReviewStore {
  if (process.env.SOLAY39_REVIEW_STORE === "local") {
    const root = process.env.SOLAY39_REVIEW_LOCAL_DIR
    if (!root) throw new ReviewError("STORE_CONFIGURATION", "Directory locale isolata non configurata.", 503)
    return new LocalReviewStore(root)
  }
  if (process.env.SOLAY39_REVIEW_STORE !== "supabase") throw new ReviewError("STORE_CONFIGURATION", "Selezionare esplicitamente l'archivio privato.", 503)
  return new SupabaseReviewStore(privateClient())
}
