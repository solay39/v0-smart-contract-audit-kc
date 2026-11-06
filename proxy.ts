// Central access control for every API route.
//
// Policy: Solay39 is founder-only. Deny by default.
//   - Public: read-only GET endpoints that serve already published audits.
//   - Machine: cron/webhook endpoints, authenticated by their own secret.
//   - Everything else (audits, analyses, AI calls, attestations, publishing,
//     sign-off, admin): founder session cookie or founder Bearer key required.
// Cookie-authenticated state-changing requests must also come from the same
// origin (CSRF protection, needed because the session cookie is SameSite=None).

import { NextResponse, type NextRequest } from "next/server"
import { FOUNDER_COOKIE, hasFounderCredentials } from "@/lib/founder-auth"

const PUBLIC_GET: RegExp[] = [
  /^\/api\/audits$/,
  /^\/api\/audit\/[^/]+$/,
  /^\/api\/audit\/[^/]+\/verify$/,
  /^\/api\/badge\/[^/]+$/,
  /^\/api\/verify$/,
  /^\/api\/prices$/,
  /^\/api\/solana-status$/,
  /^\/api\/security-intelligence\/snapshot$/,
]

// Login/logout endpoint: must stay reachable to obtain a session.
const SESSION_ENDPOINT = /^\/api\/founder\/session$/

// Scheduled jobs: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
const CRON_ENDPOINTS: RegExp[] = [/^\/api\/cron\//, /^\/api\/skynet-realtime$/]

// Alchemy webhook: verified inside the route with X-Alchemy-Signature.
const SIGNED_WEBHOOKS: RegExp[] = [/^\/api\/monitor\/webhook$/]

const matches = (path: string, list: RegExp[]) => list.some((rx) => rx.test(path))

function deny(status: 401 | 403, error: string) {
  return NextResponse.json({ success: false, error }, { status })
}

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true // server-to-server or same-origin navigation
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function hasCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const method = req.method.toUpperCase()

  if (method === "OPTIONS") return NextResponse.next()
  if (SESSION_ENDPOINT.test(path)) return NextResponse.next()
  if ((method === "GET" || method === "HEAD") && matches(path, PUBLIC_GET)) return NextResponse.next()
  if (matches(path, SIGNED_WEBHOOKS)) return NextResponse.next()
  if (matches(path, CRON_ENDPOINTS) && hasCronSecret(req)) return NextResponse.next()

  const cookie = req.cookies.get(FOUNDER_COOKIE)?.value
  if (!hasFounderCredentials(req, cookie)) return deny(401, "Founder access required")

  const usesBearer = req.headers.get("authorization")?.startsWith("Bearer ")
  if (!usesBearer && method !== "GET" && method !== "HEAD" && !isSameOrigin(req)) {
    return deny(403, "Cross-origin request blocked")
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
