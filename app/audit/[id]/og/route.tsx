import { ImageResponse } from "next/og"
import { getPublishedAudit } from "@/lib/get-published-audit"
import { scoreColor, ratingOf, getWeightedScore } from "@/lib/solay39-constants"

export const runtime = "nodejs"
export const revalidate = 3600

// Satori aborts the whole image if a remote <img> fails or stalls, so the logo is
// fetched up front with a timeout and embedded as a data URL (or skipped).
async function loadLogoAsDataUrl(src?: string): Promise<string | null> {
  if (!src || !/^https?:\/\//.test(src)) return null
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(3000) })
    const type = res.headers.get("content-type") || ""
    if (!res.ok || !/image\/(png|jpe?g|gif)/.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 500_000) return null
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const p = await getPublishedAudit(id)

  if (!p) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0e14",
            color: "#7a8c9e",
            fontSize: 32,
            fontFamily: "monospace",
          }}
        >
          Audit Not Found
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }

  const ws = getWeightedScore(p)
  const wr = ratingOf(ws)
  const sc = scoreColor(ws)
  const ratingColor = sc
  const logo = await loadLogoAsDataUrl(p.logoUrl)
  const name = p.name || "Audit"
  const subtitle = [p.ticker, p.network].filter(Boolean).join(" | ")

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0e14",
          padding: "60px 70px",
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.03,
            backgroundImage:
              "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #00ff88, #00e5ff, #00ff88)",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#00ff88",
                letterSpacing: "0.15em",
              }}
            >
              SOLAY39
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#3e5060",
                letterSpacing: "0.12em",
              }}
            >
              SKYNET SECURITY AUDIT
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid #00ff8833",
              padding: "6px 16px",
              color: "#00ff88",
              fontSize: 12,
              letterSpacing: "0.15em",
            }}
          >
            VERIFIED AUDIT
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 50,
            alignItems: "center",
          }}
        >
          {/* Left side: Token info */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* Token name + ticker */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              {/* Logo placeholder */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  color: sc,
                  backgroundColor: `${sc}15`,
                  border: `2px solid ${sc}33`,
                }}
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} width={56} height={56} alt="" style={{ borderRadius: 8 }} />
                ) : (
                  name.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#e0eaf0", lineHeight: 1.1 }}>
                  {name}
                </div>
                {subtitle ? (
                  <div style={{ display: "flex", fontSize: 16, color: "#3e5060", marginTop: 4 }}>
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Findings summary */}
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              {[
                { label: "CRITICAL", count: p.criticals, color: "#ff3b5c" },
                { label: "HIGH", count: p.highs, color: "#ff8800" },
                { label: "MEDIUM", count: p.mediums, color: "#ffc107" },
                { label: "LOW", count: p.lows, color: "#00e5ff" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    border: `1px solid ${s.color}33`,
                    backgroundColor: `${s.color}08`,
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{String(s.count ?? 0)}</span>
                  <span style={{ fontSize: 10, color: s.color, letterSpacing: "0.1em", opacity: 0.8 }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Date + Auditor */}
            <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
              <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#3e5060" }}>
                <span>Auditor:</span>
                <span style={{ color: "#7a8c9e" }}>{p.auditor || "Solay39"}</span>
              </div>
              <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#3e5060" }}>
                <span>Date:</span>
                <span style={{ color: "#7a8c9e" }}>{p.date || "-"}</span>
              </div>
            </div>
          </div>

          {/* Right side: Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 160,
                height: 160,
                borderRadius: "50%",
                border: `4px solid ${sc}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${sc}08`,
              }}
            >
              <div style={{ display: "flex", fontSize: 56, fontWeight: 900, color: sc, lineHeight: 1 }}>
                {String(ws)}
              </div>
              <div style={{ fontSize: 12, color: "#7a8c9e", letterSpacing: "0.12em", marginTop: 4 }}>
                / 100
              </div>
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: ratingColor,
                letterSpacing: "0.15em",
                border: `2px solid ${ratingColor}44`,
                padding: "6px 20px",
              }}
            >
              {wr}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 30,
            paddingTop: 20,
            borderTop: "1px solid #1a2533",
          }}
        >
          <div style={{ display: "flex", fontSize: 11, color: "#3e5060", letterSpacing: "0.1em" }}>
            {`solay39.eu/audit/${id}`}
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
