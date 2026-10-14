#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p reports
FOUNDRY_BIN="$HOME/.foundry/bin"
FOUNDRY_VERSION_DIR="$(find "$HOME/.foundry/versions/foundry-rs/foundry" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -V | tail -n 1)"
export PATH="$FOUNDRY_BIN${FOUNDRY_VERSION_DIR:+:$FOUNDRY_VERSION_DIR}:$HOME/.local/bin:$PATH"

if ! command -v forge >/dev/null 2>&1; then
  if [[ -x "$ROOT/scripts/install_foundry.sh" ]]; then "$ROOT/scripts/install_foundry.sh"; else curl -fsSL https://foundry.paradigm.xyz | bash; fi
  FOUNDRY_VERSION_DIR="$(find "$HOME/.foundry/versions/foundry-rs/foundry" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -V | tail -n 1)"
  export PATH="$FOUNDRY_BIN${FOUNDRY_VERSION_DIR:+:$FOUNDRY_VERSION_DIR}:$HOME/.local/bin:$PATH"
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "forge non trovato nel PATH dopo l'installazione" >&2
  exit 1
fi

forge test -vvvv 2>&1 | tee reports/forge_output.txt

if command -v slither >/dev/null 2>&1; then
  slither . --config-file slither.config.json --json reports/slither-report.json || true
else
  echo "Slither not installed; skipped." | tee reports/slither_output.txt
fi

if command -v myth >/dev/null 2>&1; then
  for contract in contracts/Solay39EnterpriseRegistry.sol contracts/Solay39AuditRegistry.sol contracts/AuditRegistry.sol; do
    myth analyze "$contract" -o json --execution-timeout 120 > "reports/mythril-$(basename "$contract" .sol).json" || true
  done
else
  echo "Mythril not installed; skipped." | tee reports/mythril_output.txt
fi

if command -v echidna-test >/dev/null 2>&1 && [[ -f echidna/echidna.yaml ]]; then
  echidna-test echidna --config echidna/echidna.yaml 2>&1 | tee reports/echidna_output.txt || true
else
  echo "Echidna not installed or harness missing; skipped." | tee reports/echidna_output.txt
fi

python3 scripts/aggregate_reports.py --reports-dir reports --out reports/summary.json
