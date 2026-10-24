# Solay39 benchmark evaluator

This directory contains an evaluator, not a validated vulnerability corpus.

Use a reviewed JSON object with `dataset_version` and `cases`; each case contains `case_id`, `expected_findings`, and `actual_findings`. Finding IDs must be normalized consistently. The evaluator reports exact-ID micro TP/FP/FN, precision, recall, F1, and per-case metrics.

```bash
python benchmarks/evaluate.py --input benchmarks/your-reviewed-dataset.json --output benchmark-results.json
```

Before making performance claims, freeze source hashes, compiler/tool versions, configuration, and ground truth review. Include safe contracts, skipped/timeout cases, false positives and false negatives. Do not claim superiority from a small or hand-selected sample.
