#!/usr/bin/env bash
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-${1:-}}"
RUN_ID="${2:-}"
OUTPUT_DIR="${SECURITY_ARTIFACT_DIR:-security-artifacts}"
ARTIFACT_NAME="${SECURITY_ARTIFACT_NAME:-security-reports}"

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 OWNER/REPO [RUN_ID]" >&2
  exit 2
fi
command -v gh >/dev/null 2>&1 || { echo "gh CLI is required" >&2; exit 1; }

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

if [[ -z "$RUN_ID" ]]; then
  RUN_ID="$(gh run list --repo "$REPO" --workflow security.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
fi
[[ -n "$RUN_ID" ]] || { echo "No security workflow run found for $REPO" >&2; exit 1; }

echo "Downloading $ARTIFACT_NAME from run $RUN_ID"
gh run download "$RUN_ID" --repo "$REPO" --name "$ARTIFACT_NAME" --dir "$OUTPUT_DIR"

REPORTS_DIR="$OUTPUT_DIR/reports"
if [[ ! -d "$REPORTS_DIR" ]]; then
  REPORTS_DIR="$OUTPUT_DIR"
fi
python3 scripts/aggregate_reports.py --reports-dir "$REPORTS_DIR" --out "$OUTPUT_DIR/summary.json"
echo "Artifacts: $OUTPUT_DIR"
echo "Summary: $OUTPUT_DIR/summary.json"
