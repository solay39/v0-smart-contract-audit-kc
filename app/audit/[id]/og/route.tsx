import { ImageResponse } from "next/og"
import { DEFAULT_PROJECTS, scoreColor, ratingOf, getWeightedScore, type PortfolioProject } from "@/lib/solay39-constants"
import { list } from "@vercel/blob"

const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

async function fetchBlobAudit(id: string): Promise<PortfolioProject | null> {
  try {
    // Direct blob lookup — same logic as the API route, works server-side
    let { blobs } = await list({ prefix: `audits/${id}.json`, limit: 1 })
    if (blobs.length === 0) {
      const r2 = await list({ prefix: `audits/${id}`, limit: 5 })
      blobs = r2.blobs.filter(b => b.pathname.endsWith(".json"))
    }
    if (blobs.length === 0) {
      const all = await list({ prefix: "audits/" })
      const match = all.blobs.find(b =>
        b.pathname.includes(id) ||
        b.pathname.replace("audits/", "").replace(".json", "") === id
      )
      if (match) blobs = [match]
    }
    if (blobs.length === 0) return null
    const res = await fetch(blobs[0].url, { cache: "no-store" })
    if (!res.ok) return null
    return await res.json() as PortfolioProject
  } catch {
    return null
  }
}

// Node runtime per poter usare @vercel/blob
export const runtime = "nodejs"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const p = projectMap.get(id) || (await fetchBlobAudit(id))

  if (!p) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            backgroundColor: "#0a0e14", color: "#7a8c9e",
            fontSize: 32, fontFamily: "monospace",
          }}
        >
          Audit Not Found — {id}
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }

  const ws = getWeightedScore(p)
  const wr = ratingOf(ws)
  const sc = scoreColor(ws)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          backgroundColor: "#0a0e14", padding: "60px 70px",
          fontFamily: "monospace", position: "relative", overflow: "hidden",
        }}
      >
        {/* Top accent bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(90deg, #00ff88, #00e5ff, #00ff88)",
        }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#00ff88", letterSpacing: "0.15em" }}>
              SOLAY39
            </div>
            <div style={{ fontSize: 14, color: "#3e5060", letterSpacing: "0.12em" }}>
              SKYNET SECURITY AUDIT
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            border: "1px solid #00ff8833", padding: "6px 16px",
            color: "#00ff88", fontSize: 12, letterSpacing: "0.15em",
          }}>
            VERIFIED AUDIT
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flex: 1, gap: 50, alignItems: "center" }}>
          {/* Left */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 800, color: sc,
                backgroundColor: `${sc}15`, border: `2px solid ${sc}33`,
              }}>
                {p.logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.logoUrl} width={56} height={56} alt="" style={{ borderRadius: 8 }} />
                  : p.name.charAt(0).toUpperCase()
                }
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: "#e0eaf0", lineHeight: 1.1 }}>
                  {p.name}
                </div>
                {p.ticker && (
                  <div style={{ fontSize: 16, color: "#3e5060", marginTop: 4 }}>
                    {p.ticker} | {p.network}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              {[
                { label: "CRITICAL", count: p.criticals, color: "#ff3b5c" },
                { label: "HIGH",     count: p.highs,     color: "#ff8800" },
                { label: "MEDIUM",   count: p.mediums,   color: "#ffc107" },
                { label: "LOW",      count: p.lows,      color: "#00e5ff" },
              ].map((s) => (
                <div key={s.label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", border: `1px solid ${s.color}33`,
                  backgroundColor: `${s.color}08`,
                }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.count}</span>
                  <span style={{ fontSize: 10, color: s.color, letterSpacing: "0.1em", opacity: 0.8 }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
              <div style={{ fontSize: 12, color: "#3e5060" }}>
                Auditor: <span style={{ color: "#7a8c9e" }}>{p.auditor || "Solay39"}</span>
              </div>
              <div style={{ fontSize: 12, color: "#3e5060" }}>
                Date: <span style={{ color: "#7a8c9e" }}>{p.date}</span>
              </div>
            </div>
          </div>

          {/* Right: Score ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 160, height: 160, borderRadius: "50%",
              border: `4px solid ${sc}`, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", backgroundColor: `${sc}08`,
            }}>
              <div style={{ fontSize: 56, fontWeight: 900, color: sc, lineHeight: 1 }}>{ws}</div>
              <div style={{ fontSize: 12, color: "#7a8c9e", letterSpacing: "0.12em", marginTop: 4 }}>/ 100</div>
            </div>
            <div style={{
              fontSize: 24, fontWeight: 800, color: sc, letterSpacing: "0.15em",
              border: `2px solid ${sc}44`, padding: "6px 20px",
            }}>
              {wr}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 30, paddingTop: 20, borderTop: "1px solid #1a2533",
        }}>
          <div style={{ fontSize: 11, color: "#3e5060", letterSpacing: "0.1em" }}>
            solay39.eu/audit/{p.id}
          </div>
          <div style={{ fontSize: 11, color: "#3e5060", letterSpacing: "0.1em" }}>
            SOLAY39 SMART CONTRACT SECURITY
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
