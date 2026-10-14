#!/usr/bin/env bash
set -euo pipefail

if ! command -v forge >/dev/null 2>&1; then
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
fi

forge test -vvvv
slither . --config-file slither.config.json --json slither-report.json || true
myth analyze contracts/Solay39EnterpriseRegistry.sol -o json --execution-timeout 120 > mythril-report.json || true
printf 'Reports: slither-report.json mythril-report.json\n'
