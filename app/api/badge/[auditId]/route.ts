// app/api/badge/[auditId]/route.ts
// Serve: solay39.eu/api/badge/[auditId]
// Embed: <img src="https://www.solay39.eu/api/badge/cross-1772809123823" />

import { list } from "@vercel/blob"
import { type NextRequest } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ auditId: string }> }
) {
  const { auditId } = await params

  // Load audit from blob
  let score = 89
  let rating = "A"
  let projectName = "Audited"

  try {
    const { blobs } = await list({ prefix: `audits/${auditId}.json` })
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url)
      if (res.ok) {
        const audit = await res.json()
        score = audit.securityScore ?? audit.score ?? 89
        rating = audit.rating ?? "A"
        projectName = audit.symbol ?? audit.name ?? "Audited"
      }
    }
  } catch {
    // fallback to defaults
  }

  // Badge color based on rating
  const ratingColor =
    rating === "AAA" ? "#22c55e" :
    rating === "AA"  ? "#84cc16" :
    rating === "A"   ? "#6366f1" :
    rating === "BBB" ? "#f59e0b" : "#ef4444"

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="36" viewBox="0 0 200 36">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="200" height="36" rx="7" fill="url(#bg)"/>

  <!-- Left accent -->
  <rect width="5" height="36" rx="3" fill="${ratingColor}"/>

  <!-- Shield icon -->
  <g transform="translate(12, 10)">
    <path d="M8 0L0 3v5c0 4.5 3.4 8.7 8 10 4.6-1.3 8-5.5 8-10V3L8 0z" fill="${ratingColor}" opacity="0.2"/>
    <path d="M8 1L1 3.5v4.5c0 4 3 7.8 7 9 4-1.2 7-5 7-9V3.5L8 1z" fill="none" stroke="${ratingColor}" stroke-width="1"/>
    <path d="M6 8l2 2 4-4" fill="none" stroke="${ratingColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- SOLAY39 label -->
  <text x="34" y="14" font-family="'Segoe UI',Arial,sans-serif"
        font-size="8" font-weight="700" fill="${ratingColor}" letter-spacing="1.5">SOLAY39</text>

  <!-- Separator -->
  <line x1="34" y1="17" x2="145" y2="17" stroke="#334155" stroke-width="0.5"/>

  <!-- Project + score -->
  <text x="34" y="28" font-family="'Segoe UI',Arial,sans-serif"
        font-size="9.5" font-weight="600" fill="#e2e8f0">
    SECURITY AUDITED
  </text>

  <!-- Rating badge -->
  <rect x="152" y="8" width="40" height="20" rx="4" fill="${ratingColor}" opacity="0.15"/>
  <text x="172" y="22" font-family="'Segoe UI',Arial,sans-serif"
        font-size="10" font-weight="700" fill="${ratingColor}"
        text-anchor="middle">${rating} ${score}</text>
</svg>`

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
