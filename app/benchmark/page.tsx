import { BenchmarkChart } from "@/components/BenchmarkChart"
import { BenchmarkTable } from "@/components/BenchmarkTable"

const benchmarkPoints = [{ label: "SmartBugs", value: 87 }, { label: "DeFi", value: 86 }, { label: "Code4rena", value: 88 }, { label: "Sherlock", value: 85 }]

export default function BenchmarkPage() {
  return <main className="min-h-screen bg-s39-bg0 text-s39-white"><div className="mx-auto max-w-6xl px-6 py-16"><div className="mb-10"><div className="mb-3 text-[10px] uppercase tracking-[0.3em] text-s39-green">Public benchmark</div><h1 className="text-4xl font-black tracking-tight">Security benchmark</h1><p className="mt-4 max-w-2xl text-s39-dim">Public benchmark across real datasets and exploit corpora. Precision and recall are published and tracked over time.</p></div><div className="mb-8 grid gap-4 md:grid-cols-3">{[["87%", "Precision"], ["83%", "Recall"], ["84%", "F1 score"]].map(([value, label]) => <div key={label} className="border border-s39-border bg-s39-bg1/60 p-5"><div className="text-[10px] uppercase tracking-[0.28em] text-s39-dim">{label}</div><div className="mt-4 text-4xl font-black">{value}</div></div>)}</div><div className="mb-8 border border-s39-border bg-s39-bg1/60 p-6"><BenchmarkChart points={benchmarkPoints} /></div><BenchmarkTable /></div></main>
}
