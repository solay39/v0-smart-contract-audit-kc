export interface BenchmarkEntry {
  id: string
  dataset: string
  samples: number
  truePositive: number
  falsePositive: number
  falseNegative: number
  precision: number
  recall: number
  f1: number
  date: string
}

// Keep this empty until benchmark runs are produced from a versioned dataset,
// reviewed labels, and reproducible evaluation artifacts. Never publish demo metrics
// as measured security performance.
export const benchmarkHistory: BenchmarkEntry[] = []
