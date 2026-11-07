/** Read-only display policy. Legacy scores/signatures are not verified approvals. */
export interface DirectoryProject {
  id: string
  name: string
  ticker: string
  network: string
  address: string
  logoUrl: string | null
  reportedAt: string | null
  findings: number | null
  highFindings: number | null
  status: "preliminary"
}
export interface DirectorySnapshot {
  projects: DirectoryProject[]
  observedAt: string
}
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : ""
export function directoryLogo(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    const hosts = [
      "coingecko.com",
      "coinmarketcap.com",
      "solay39.eu",
      "raw.githubusercontent.com",
    ]
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts.some((h) => url.hostname === h || url.hostname.endsWith("." + h))
      ? url.href
      : null
  } catch {
    return null
  }
}
export function normalizeDirectory(value: unknown): DirectoryProject[] {
  if (!Array.isArray(value)) throw new Error("Invalid public directory.")
  const seen = new Set<string>()
  const projects: DirectoryProject[] = []
  for (const raw of value.slice(0, 1000)) {
    if (!raw || typeof raw !== "object") continue
    const p = raw as Record<string, unknown>
    const id = text(p.id, 201)
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(id) || seen.has(id)) continue
    seen.add(id)
    const findings = Array.isArray(p.findings) ? p.findings : null
    const rawDate = text(p.createdAt || p.created_at || p.date, 80)
    // ID timestamps are identifiers, not proof of an audit date.
    const parsed = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(rawDate)
      ? Date.parse(rawDate)
      : NaN
    const date =
      Number.isFinite(parsed) &&
      new Date(parsed).toISOString().slice(0, 10) === rawDate.slice(0, 10)
        ? parsed
        : NaN
    projects.push({
      id,
      name: text(p.name, 200) || "Unnamed project",
      ticker: text(p.ticker || p.symbol, 24),
      network: text(p.network || p.chain, 60) || "Not disclosed",
      address: text(p.contractAddress || p.address, 160),
      logoUrl: directoryLogo(p.logoUrl),
      reportedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
      findings: findings ? findings.length : null,
      highFindings: findings
        ? findings.filter(
            (f) =>
              f &&
              typeof f === "object" &&
              ["HIGH", "CRITICAL"].includes(String(f.severity).toUpperCase())
          ).length
        : null,
      status: "preliminary",
    })
  }
  return projects
}
export type DirectoryOrder = "name" | "recent" | "findings"
export function selectDirectory(
  projects: DirectoryProject[],
  query: string,
  network: string,
  order: DirectoryOrder
) {
  const q = query.trim().toLocaleLowerCase("en")
  return projects
    .filter(
      (p) =>
        (network === "all" || p.network === network) &&
        [p.name, p.ticker, p.id, p.address].some((v) =>
          v.toLocaleLowerCase("en").includes(q)
        )
    )
    .sort((a, b) => {
      const secondary =
        a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id)
      if (order === "recent")
        return (
          (Date.parse(b.reportedAt || "") || 0) -
            (Date.parse(a.reportedAt || "") || 0) || secondary
        )
      if (order === "findings")
        return (b.findings ?? -1) - (a.findings ?? -1) || secondary
      return secondary
    })
}
export function networkCounts(projects: DirectoryProject[]) {
  const counts = new Map<string, number>()
  for (const p of projects)
    counts.set(p.network, (counts.get(p.network) || 0) + 1)
  return [...counts]
    .map(([network, count]) => ({ network, count }))
    .sort(
      (a, b) => b.count - a.count || a.network.localeCompare(b.network, "en")
    )
}
