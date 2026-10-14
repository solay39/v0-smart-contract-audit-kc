#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p reports

forge test -vvvv 2>&1 | tee reports/forge_output.txt
forge coverage --report summary --report lcov > reports/coverage.txt 2>&1 || true

if command -v slither >/dev/null 2>&1; then
  slither . --config-file slither.config.json --json reports/slither-report.json || true
else
  echo "Slither not available; skipped." | tee reports/slither_output.txt
fi

if command -v myth >/dev/null 2>&1; then
  for contract in contracts/*.sol; do
    name="$(basename "$contract" .sol)"
    myth analyze "$contract" -o json --execution-timeout 120 > "reports/mythril-${name}.json" || true
done
else
  echo "Mythril not available; skipped." | tee reports/mythril_output.txt
fi

if command -v echidna-test >/dev/null 2>&1 && [[ -f echidna/echidna.yaml ]] && [[ -f echidna/EchidnaHarness.sol ]]; then
  echidna-test echidna --config echidna/echidna.yaml | tee reports/echidna_output.txt || true
else
  echo "Echidna not available or harness missing; skipped." | tee reports/echidna_output.txt
fi

python3 scripts/aggregate_reports.py --reports-dir reports --out reports/summary.json
printf 'Security checks completed. Reports are in reports/.\n'
