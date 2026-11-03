import Link from "next/link"
import { BenchmarkTable } from "@/components/BenchmarkTable"

export default function BenchmarkPage() {
  return (
    <main className="min-h-screen bg-s39-bg0 text-s39-white">
      <header className="border-b border-s39-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-sm font-bold tracking-[0.18em] text-s39-white">SOLAY39 <span className="font-normal text-s39-mid">/ SECURITY</span></Link>
          <nav aria-label="Main navigation" className="flex gap-6 text-xs text-s39-mid">
            <Link href="/" className="hover:text-s39-white">Portfolio</Link>
            <Link href="/benchmark" className="text-s39-green">Benchmark</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-[10px] uppercase tracking-[0.28em] text-s39-green">Public evaluation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-s39-white sm:text-4xl">Security benchmark</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-s39-mid">
          We will publish precision, recall, false positives and false negatives only when each result is tied to a versioned dataset, documented methodology and reproducible evaluation artifacts.
        </p>

        <section className="mt-10 border-y border-s39-border py-6" aria-labelledby="methodology-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="methodology-heading" className="text-sm font-semibold text-s39-white">Publication standard</h2>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-s39-mid">
                A benchmark run must identify the tool and version, dataset revision, sample count, label source, evaluation date and artifact containing the raw predictions. Until those records exist, no performance claim is displayed.
              </p>
            </div>
            <span className="w-fit border border-amber-300/30 px-3 py-1.5 text-[9px] uppercase tracking-[0.16em] text-amber-200">No validated runs published</span>
          </div>
        </section>

        <section className="mt-9" aria-labelledby="results-heading">
          <div className="mb-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-s39-dim">Measured results</p>
            <h2 id="results-heading" className="mt-1 text-lg font-medium text-s39-white">Benchmark history</h2>
          </div>
          <BenchmarkTable />
        </section>

        <p className="mt-8 max-w-3xl text-[10px] leading-5 text-s39-dim">
          This page is a product capability preview, not evidence that the audit system has achieved a particular detection rate or is equivalent to another security provider.
        </p>
      </div>
    </main>
  )
}
