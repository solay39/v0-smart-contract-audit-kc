type BenchmarkPoint = { label: string; value: number }

export function BenchmarkChart({ points }: { points: BenchmarkPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 100)
  return <div className="grid h-48 grid-cols-2 gap-4 md:grid-cols-4">{points.map((point) => <div key={point.label} className="flex items-end justify-center"><div className="flex w-full flex-col items-center"><div className="w-full rounded-t-lg bg-gradient-to-t from-s39-green to-s39-cyan" style={{ height: `${(point.value / max) * 100}%`, minHeight: "18px" }} aria-label={`${point.label}: ${point.value}%`} /><div className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-s39-dim">{point.label}</div></div></div>)}</div>
}
