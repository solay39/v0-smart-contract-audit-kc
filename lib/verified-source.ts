export interface VerifiedSourceInfo {
  contractName: string | null
  compilerVersion: string | null
  optimizerRuns: number | null
  openZeppelinVersion: string | null
  linesOfCode: number | null
  fileCount: number | null
  analyzedAddress: string | null
  proxy: {
    isProxy: boolean
    proxyType: string | null
    proxyAddress: string
    implementationAddress: string | null
    proxyAdmin: string | null
  } | null
}

export function toVerifiedSourceInfo(data: Record<string, unknown>): VerifiedSourceInfo {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const str = (v: unknown) => (typeof v === "string" && v ? v : null)
  return {
    contractName: str(data.contractName),
    compilerVersion: str(data.compilerVersion),
    optimizerRuns: num(data.optimizerRuns),
    openZeppelinVersion: str(data.openZeppelinVersion),
    linesOfCode: num(data.linesOfCode),
    fileCount: num(data.fileCount),
    analyzedAddress: str(data.analyzedAddress),
    proxy: (data.proxy as VerifiedSourceInfo["proxy"]) ?? null,
  }
}

/**
 * A report cannot carry a top grade while serious findings are still open,
 * regardless of how well the rest of the score model rates the contract.
 */
export function severityScoreCap(findings: { severity: string; status?: string }[]): number {
  const open = findings.filter((f) => !f.status || f.status === "OPEN")
  if (open.some((f) => f.severity === "CRITICAL")) return 59
  if (open.some((f) => f.severity === "HIGH")) return 79
  if (open.some((f) => f.severity === "MEDIUM")) return 89
  return 100
}

/** Tokens this established don't need LP-lock checks designed for fresh launches. */
export function isEstablishedToken(td: { marketCap?: number; totalHolders?: number; totalLiquidity?: number } | null | undefined): boolean {
  if (!td) return false
  return (td.marketCap ?? 0) >= 50_000_000 || (td.totalHolders ?? 0) >= 10_000 || (td.totalLiquidity ?? 0) >= 5_000_000
}

export function nonEmpty<T>(items: T[]): T[] | undefined {
  return items.length > 0 ? items : undefined
}
