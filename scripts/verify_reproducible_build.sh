#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

reports_dir="${REPORTS_DIR:-reports}"
mkdir -p "$reports_dir"

: "${EXPECTED_COMMIT:=$(git rev-parse HEAD)}"
actual_commit="$(git rev-parse HEAD)"
if [[ "$actual_commit" != "$EXPECTED_COMMIT" ]]; then
  echo "Commit mismatch: expected $EXPECTED_COMMIT, got $actual_commit" >&2
  exit 1
fi

forge --version | tee "$reports_dir/reproducible-build.txt"
forge config --json > "$reports_dir/foundry-config.json"
forge build --build-info

manifest="$reports_dir/build-manifest.sha256"
: > "$manifest"
while IFS= read -r -d '' file; do
  sha256sum "$file" >> "$manifest"
done < <(find out -type f \( -name '*.json' -o -name '*.bin' \) -print0 | sort -z)

if [[ -n "${EXPECTED_ARTIFACTS_DIR:-}" ]]; then
  [[ -d "$EXPECTED_ARTIFACTS_DIR" ]] || { echo "Expected artifacts directory not found: $EXPECTED_ARTIFACTS_DIR" >&2; exit 1; }
  diff -ru "$EXPECTED_ARTIFACTS_DIR" out > "$reports_dir/artifact-diff.txt" || {
    echo "Artifact mismatch; see $reports_dir/artifact-diff.txt" >&2
    exit 1
  }
fi

printf 'Reproducible build verified for %s\n' "$actual_commit" | tee -a "$reports_dir/reproducible-build.txt"
printf 'Manifest: %s\n' "$manifest"
