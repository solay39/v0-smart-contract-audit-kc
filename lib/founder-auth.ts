// Server-only founder authentication.
//
// Solay39 is a single-operator product: only the founder may run audits,
// analyses, attestations, publications or any other action that costs money
// or writes data. Every protected request is checked centrally in `proxy.ts`
// and again inside the sensitive route handlers.
//
// Secrets (all server-side env vars, never shipped to the client):
//   SOLAY39_FOUNDER_KEY               optional long random key for server-to-server calls
//   SOLAY39_FOUNDER_PASSWORD_SHA256   optional SHA-256 hex of the founder login password
//   SOLAY39_SESSION_SECRET            recommended HMAC secret for session cookies
// If SOLAY39_SESSION_SECRET is missing, the session secret is derived from
// SOLAY39_FOUNDER_KEY or SUPABASE_SERVICE_ROLE_KEY (both server-only). The
// session secret is NEVER derived from a value that is published in the repo.

import { createHash, createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const FOUNDER_COOKIE = "s39_founder"
const SESSION_TTL_SECONDS = 60 * 60 * 8

export const founderCookieOptions = {
  httpOnly: true,
  secure: true,
  // "none" is required for the session to survive inside the v0 preview iframe.
  // Cross-site request forgery is blocked by the Origin check in proxy.ts.
  sameSite: "none" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
}

// Legacy fingerprint of the founder password. Prefer SOLAY39_FOUNDER_PASSWORD_SHA256
// and rotate the password: this hash is public in the git history.
const LEGACY_FOUNDER_PASSWORD_SHA256 = "dc3960ab2247a0196a2d2af0390d36fb8fa8acb57c828ec16642d63a0c247cb8"

function envFounderKey(): string | null {
  const key = process.env.SOLAY39_FOUNDER_KEY?.trim()
  return key && key.length >= 12 ? key : null
}

function founderPasswordHash(): Buffer {
  const fromEnv = process.env.SOLAY39_FOUNDER_PASSWORD_SHA256?.trim().toLowerCase()
  const hex = fromEnv && /^[0-9a-f]{64}$/.test(fromEnv) ? fromEnv : LEGACY_FOUNDER_PASSWORD_SHA256
  return Buffer.from(hex, "hex")
}

/** HMAC secret for session cookies, or null when the server has no private secret configured. */
function sessionSecret(): string | null {
  const explicit = process.env.SOLAY39_SESSION_SECRET?.trim()
  if (explicit && explicit.length >= 32) return explicit
  const base = envFounderKey() ?? process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!base || base.length < 12) return null
  return createHash("sha256").update(`s39-session-v2:${base}`).digest("hex")
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b))
}

export function isValidFounderKey(candidate: unknown): boolean {
  if (typeof candidate !== "string" || candidate.length === 0) return false
  const matchesPassword = timingSafeEqual(sha256(candidate), founderPasswordHash())
  const envKey = envFounderKey()
  const matchesEnv = envKey ? safeEqual(candidate, envKey) : false
  return matchesPassword || matchesEnv
}

export function getFounderKeyForServerCall(): string | null {
  return envFounderKey()
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function createFounderSessionToken(ttlSeconds = SESSION_TTL_SECONDS): string | null {
  const secret = sessionSecret()
  if (!secret) return null
  const exp = String(Math.floor(Date.now() / 1000) + ttlSeconds)
  return `${exp}.${sign(exp, secret)}`
}

export function isValidFounderSessionToken(token: string | undefined | null): boolean {
  const secret = sessionSecret()
  if (!secret || !token) return false
  const [exp, sig] = token.split(".")
  if (!exp || !sig || !/^\d+$/.test(exp)) return false
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false
  return safeEqual(sig, sign(exp, secret))
}

/** True when the request carries founder credentials (Bearer key or session cookie). Usable from proxy.ts. */
export function hasFounderCredentials(req: Request, cookieValue?: string | null): boolean {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ") && isValidFounderKey(auth.slice(7))) return true
  return isValidFounderSessionToken(cookieValue)
}

/**
 * A request is from the founder if it carries a valid session cookie,
 * an `Authorization: Bearer <key>` header (server-to-server), or a valid
 * key in the JSON body (legacy admin panel flow).
 */
export async function isFounderRequest(req: Request, bodyKey?: unknown): Promise<boolean> {
  if (bodyKey !== undefined && isValidFounderKey(bodyKey)) return true
  const store = await cookies()
  return hasFounderCredentials(req, store.get(FOUNDER_COOKIE)?.value)
}

/**
 * Headers for internal server-to-server calls between API routes
 * (e.g. /api/skynet -> /api/static-analysis). Uses a short-lived founder session.
 */
export function internalAuthHeaders(): Record<string, string> {
  const token = createFounderSessionToken(5 * 60)
  return token ? { Cookie: `${FOUNDER_COOKIE}=${token}` } : {}
}

export function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
}

/** Returns a 401 response when the caller is not the founder, otherwise null. */
export async function requireFounder(req: Request, bodyKey?: unknown): Promise<NextResponse | null> {
  return (await isFounderRequest(req, bodyKey)) ? null : unauthorizedResponse()
}
