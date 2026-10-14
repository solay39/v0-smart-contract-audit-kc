#!/usr/bin/env bash
set -euo pipefail

URL=""
OUT_DIR="security-artifacts/frontend"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="${2:?missing URL}"; shift 2 ;;
    --out) OUT_DIR="${2:?missing output directory}"; shift 2 ;;
    -h|--help) echo "Usage: $0 --url https://example.com [--out DIR]"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$URL" ]] || { echo "Missing --url" >&2; exit 2; }
mkdir -p "$OUT_DIR"
HTML="$OUT_DIR/site.html"
CURL_ARGS=(--fail --silent --show-error --location --max-time 30 --proto '=https' --proto-redir '=https')
curl "${CURL_ARGS[@]}" "$URL" -o "$HTML"
{
  echo "URL: $URL"
  echo "Fetched: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "Contract-like addresses:"
  grep -Eo '0x[a-fA-F0-9]{40}' "$HTML" | sort -fu || true
  echo ""
  echo "Potential secret indicators (review manually; public RPC URLs may be benign):"
  grep -Eio '(api[_-]?key|infura|alchemy|private[_-]?key|mnemonic|secret|seed phrase|authorization: bearer)[^"'"'"'<>[:space:]]{0,120}' "$HTML" | sort -fu || true
  echo ""
  echo "RPC/API URLs:"
  grep -Eo 'https?://[^"'"'"'<>[:space:]]+' "$HTML" | sort -fu || true
} | tee "$OUT_DIR/scan.txt"
echo "Frontend scan written to $OUT_DIR"
