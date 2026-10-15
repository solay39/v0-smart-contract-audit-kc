import { type NextRequest, NextResponse } from "next/server"
import {
  FOUNDER_COOKIE,
  createFounderSessionToken,
  founderCookieOptions,
  isFounderRequest,
  isValidFounderKey,
} from "@/lib/founder-auth"

export const runtime = "nodejs"

const FOUNDER_EMAIL = (process.env.SOLAY39_FOUNDER_EMAIL || "lippo.f80@gmail.com").toLowerCase()
const FAILED_LOGIN_DELAY_MS = 800

export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: await isFounderRequest(req) })
}

export async function POST(req: NextRequest) {
  let email: unknown
  let password: unknown
  try {
    ;({ email, password } = await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const emailOk = typeof email === "string" && email.trim().toLowerCase() === FOUNDER_EMAIL
  const passOk = isValidFounderKey(password)

  if (!emailOk || !passOk) {
    await new Promise((r) => setTimeout(r, FAILED_LOGIN_DELAY_MS))
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  const token = createFounderSessionToken()
  if (!token) {
    return NextResponse.json({ error: "Server auth not configured" }, { status: 503 })
  }

  const res = NextResponse.json({ authenticated: true })
  res.cookies.set(FOUNDER_COOKIE, token, founderCookieOptions)
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ authenticated: false })
  res.cookies.set(FOUNDER_COOKIE, "", { ...founderCookieOptions, maxAge: 0 })
  return res
}
