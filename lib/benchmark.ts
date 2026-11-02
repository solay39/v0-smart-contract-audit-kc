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

export const benchmarkHistory: BenchmarkEntry[] = [
  { id: "smartbugs-v1", dataset: "SmartBugs", samples: 120, truePositive: 76, falsePositive: 11, falseNegative: 18, precision: 0.87, recall: 0.81, f1: 0.84, date: "2026-01-01" },
  { id: "defihacklabs-v1", dataset: "DeFiHackLabs", samples: 88, truePositive: 58, falsePositive: 9, falseNegative: 12, precision: 0.86, recall: 0.83, f1: 0.84, date: "2026-03-01" },
  { id: "code4rena-v1", dataset: "Code4rena", samples: 74, truePositive: 49, falsePositive: 7, falseNegative: 9, precision: 0.88, recall: 0.84, f1: 0.86, date: "2026-05-01" },
  { id: "sherlock-v1", dataset: "Sherlock", samples: 63, truePositive: 40, falsePositive: 6, falseNegative: 8, precision: 0.87, recall: 0.83, f1: 0.85, date: "2026-06-01" },
]
