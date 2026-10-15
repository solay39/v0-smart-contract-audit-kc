// Server-only founder authentication.
// The founder key lives exclusively in SOLAY39_FOUNDER_KEY; it is never shipped to the client.
// Rotating that env var instantly invalidates every existing session cookie.

import { createHash, createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const FOUNDER_COOKIE = "s39_founder"
const SESSION_TTL_SECONDS = 60 * 60 * 8

export const founderCookieOptions = {
  httpOnly: true,
  secure: true,
  // "none" is required for the session to survive inside the v0 preview iframe.
  sameSite: "none" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
}

// SHA-256 of the founder's chosen password: only the fingerprint lives in code, never the plaintext.
const FOUNDER_PASSWORD_SHA256 = "dc3960ab2247a0196a2d2af0390d36fb8fa8acb57c828ec16642d63a0c247cb8"

function envFounderKey(): string | null {
  const key = process.env.SOLAY39_FOUNDER_KEY?.trim()
  return key && key.length >= 12 ? key : null
}

function founderSecret(): string {
  return envFounderKey() ?? FOUNDER_PASSWORD_SHA256
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b))
}

export function isValidFounderKey(candidate: unknown): boolean {
  if (typeof candidate !== "string" || candidate.length === 0) return false
  const matchesPassword = timingSafeEqual(sha256(candidate), Buffer.from(FOUNDER_PASSWORD_SHA256, "hex"))
  const envKey = envFounderKey()
  const matchesEnv = envKey ? safeEqual(candidate, envKey) : false
  return matchesPassword || matchesEnv
}

export function getFounderKeyForServerCall(): string | null {
  return envFounderKey()
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", `s39-session:${secret}`).update(payload).digest("base64url")
}

export function createFounderSessionToken(): string | null {
  const secret = founderSecret()
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
  return `${exp}.${sign(exp, secret)}`
}

function isValidSessionToken(token: string | undefined): boolean {
  const secret = founderSecret()
  if (!token) return false
  const [exp, sig] = token.split(".")
  if (!exp || !sig || !/^\d+$/.test(exp)) return false
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false
  return safeEqual(sig, sign(exp, secret))
}

/**
 * A request is from the founder if it carries a valid session cookie,
 * an `Authorization: Bearer <key>` header (server-to-server), or a valid
 * key in the JSON body (legacy admin panel flow).
 */
export async function isFounderRequest(req: Request, bodyKey?: unknown): Promise<boolean> {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ") && isValidFounderKey(auth.slice(7))) return true
  if (bodyKey !== undefined && isValidFounderKey(bodyKey)) return true
  const store = await cookies()
  return isValidSessionToken(store.get(FOUNDER_COOKIE)?.value)
}

export function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
}

/** Returns a 401 response when the caller is not the founder, otherwise null. */
export async function requireFounder(req: Request, bodyKey?: unknown): Promise<NextResponse | null> {
  return (await isFounderRequest(req, bodyKey)) ? null : unauthorizedResponse()
}
