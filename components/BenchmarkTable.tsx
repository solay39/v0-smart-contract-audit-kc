import { benchmarkHistory } from "@/lib/benchmark"

export function BenchmarkTable() {
  if (benchmarkHistory.length === 0) {
    return (
      <div className="border border-s39-border bg-s39-bg1/50 px-5 py-10 text-center">
        <p className="text-sm font-medium text-s39-white">No validated benchmark results yet</p>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-s39-mid">
          Results will appear here after a reproducible run has been completed and its dataset, methodology and artifacts are published.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border border-s39-border bg-s39-bg1/50">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">Published benchmark results</caption>
        <thead className="bg-s39-bg2 text-s39-mid">
          <tr>
            <th scope="col" className="px-4 py-3">Dataset</th>
            <th scope="col" className="px-4 py-3">Samples</th>
            <th scope="col" className="px-4 py-3">Precision</th>
            <th scope="col" className="px-4 py-3">Recall</th>
            <th scope="col" className="px-4 py-3">F1</th>
            <th scope="col" className="px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {benchmarkHistory.map((row) => (
            <tr key={row.id} className="border-t border-s39-border text-s39-lite">
              <td className="px-4 py-3">{row.dataset}</td>
              <td className="px-4 py-3">{row.samples}</td>
              <td className="px-4 py-3">{(row.precision * 100).toFixed(1)}%</td>
              <td className="px-4 py-3">{(row.recall * 100).toFixed(1)}%</td>
              <td className="px-4 py-3">{(row.f1 * 100).toFixed(1)}%</td>
              <td className="px-4 py-3">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
