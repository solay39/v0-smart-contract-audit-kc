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

function founderSecret(): string | null {
  const key = process.env.SOLAY39_FOUNDER_KEY
  return key && key.length >= 12 ? key : null
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function isValidFounderKey(candidate: unknown): boolean {
  const secret = founderSecret()
  if (!secret || typeof candidate !== "string" || candidate.length === 0) return false
  return safeEqual(candidate, secret)
}

export function getFounderKeyForServerCall(): string | null {
  return founderSecret()
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", `s39-session:${secret}`).update(payload).digest("base64url")
}

export function createFounderSessionToken(): string | null {
  const secret = founderSecret()
  if (!secret) return null
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
  return `${exp}.${sign(exp, secret)}`
}

function isValidSessionToken(token: string | undefined): boolean {
  const secret = founderSecret()
  if (!secret || !token) return false
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
  if (!founderSecret()) {
    console.error("[founder-auth] SOLAY39_FOUNDER_KEY missing or too short: refusing protected request")
    return NextResponse.json({ success: false, error: "Server auth not configured" }, { status: 503 })
  }
  return (await isFounderRequest(req, bodyKey)) ? null : unauthorizedResponse()
}
