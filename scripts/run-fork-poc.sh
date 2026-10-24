#!/usr/bin/env bash
set -euo pipefail
: "${FORK_RPC_URL:?FORK_RPC_URL is required}"
: "${FORK_BLOCK_NUMBER:?FORK_BLOCK_NUMBER is required}"
mkdir -p reports/fork
command -v anvil >/dev/null
command -v cast >/dev/null
anvil --fork-url "$FORK_RPC_URL" --fork-block-number "$FORK_BLOCK_NUMBER" --port 8545 > reports/fork/anvil.log 2>&1 &
anvil_pid=$!
trap 'kill "$anvil_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do cast block-number --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1 && break; sleep 1; done
actual_block="$(cast block-number --rpc-url http://127.0.0.1:8545)"
[ "$actual_block" = "$FORK_BLOCK_NUMBER" ]
cast chain-id --rpc-url http://127.0.0.1:8545 > reports/fork/chain-id.txt
cast block "$actual_block" --rpc-url http://127.0.0.1:8545 --json > reports/fork/block.json
cat > reports/fork-evidence.json <<EOF
{"targetCommit":"$(git rev-parse HEAD)","rpcNetwork":"fork:$FORK_RPC_URL","blockNumber":$actual_block,"pocs":[{"findingId":"fork-connectivity-001","command":"run-fork-poc.sh","status":"passed","artifactPath":"reports/fork/block.json"}]}
EOF
node scripts/validate-fork-evidence.mjs reports/fork-evidence.json
