// Pure lookup policy shared by public audit readers. No browser-local data.
const aliases: Record<string, string> = {
  "injective-token": "inj-token",
  "fetch-ai": "fetch-token",
  "chiliz-token": "chz-token",
}

export function isPublicAuditId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(id)
}

export function publicAuditIds(id: string): string[] {
  if (!isPublicAuditId(id)) return []
  return [...new Set([id, aliases[id] ?? id])]
}

/** Uploading an HTML artifact is not the same as publishing a server-readable audit. */
export function publicPublicationReceipt(saved: boolean, artifactUrl?: string) {
  return {
    success: saved,
    publicationStatus: saved ? "PUBLISHED" : artifactUrl ? "ARTIFACTS_ONLY" : "FAILED",
    httpStatus: saved ? 200 : 503,
  } as const
}

/** Prefix matches are not identity: never return another audit's JSON. */
export function exactAuditBlob<T extends { pathname: string }>(blobs: T[], id: string): T | undefined {
  return blobs.find((blob) => blob.pathname === `audits/${id}.json`)
}

export async function lookupPublishedAudit<T extends { id: string }>(
  id: string,
  readers: Array<(candidate: string) => T | null | Promise<T | null>>,
): Promise<T | null> {
  const ids = publicAuditIds(id)
  for (const read of readers) {
    for (const candidate of ids) {
      const result = await read(candidate)
      // Explicit aliases may point at a canonical ID, but unrelated records cannot.
      if (result && ids.includes(result.id)) return result
    }
  }
  return null
}
