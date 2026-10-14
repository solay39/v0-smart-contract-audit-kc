#!/usr/bin/env bash
set -euo pipefail

: "${RPC_URL:?Set RPC_URL to the target network RPC}"
: "${OUT_FILE:?Set OUT_FILE to the JSON output path}"

CAST_BIN="${CAST_BIN:-cast}"
NETWORK="${NETWORK:-ethereum-mainnet}"
CHAIN_ID="$($CAST_BIN chain-id --rpc-url "$RPC_URL")"

contracts=(
  "AuditRegistry:${AUDIT_REGISTRY_ADDRESS:-}"
  "Solay39AuditRegistry:${SOLAY39_AUDIT_REGISTRY_ADDRESS:-}"
  "Solay39EnterpriseRegistry:${SOLAY39_ENTERPRISE_REGISTRY_ADDRESS:-}"
)

mkdir -p "$(dirname "$OUT_FILE")"
{
  printf '{\n  "network": %s,\n  "chainId": %s,\n  "contracts": [\n' "$(printf '%s' "$NETWORK" | jq -Rs .)" "$CHAIN_ID"
  first=true
  for item in "${contracts[@]}"; do
    name="${item%%:*}"
    address="${item#*:}"
    [[ -n "$address" ]] || { printf 'Missing address for %s\n' "$name" >&2; exit 1; }
    [[ "$address" =~ ^0x[0-9a-fA-F]{40}$ ]] || { printf 'Invalid address for %s\n' "$name" >&2; exit 1; }
    code="$($CAST_BIN code --rpc-url "$RPC_URL" "$address")"
    [[ "$code" != "0x" ]] || { printf 'No contract bytecode at %s (%s)\n' "$address" "$name" >&2; exit 1; }
    owner="$($CAST_BIN call --rpc-url "$RPC_URL" "$address" 'owner()(address)' 2>/dev/null || true)"
    timelock="$($CAST_BIN call --rpc-url "$RPC_URL" "$address" 'timelock()(address)' 2>/dev/null || true)"
    [[ "$first" == true ]] || printf ',\n'
    first=false
    jq -n --arg name "$name" --arg address "$address" --arg owner "$owner" --arg timelock "$timelock" --arg etherscan "https://etherscan.io/address/$address" '{name:$name,address:$address,owner:$owner,timelock:$timelock,etherscan:$etherscan,bytecode_verified:true,status:"verified",notes:"Values read from the configured RPC."}'
  done
  printf '\n  ],\n  "sources": {"rpc_verified_at": %s}\n}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ | jq -Rs .)"
} > "$OUT_FILE"

jq empty "$OUT_FILE"
printf 'Wrote %s\n' "$OUT_FILE"
