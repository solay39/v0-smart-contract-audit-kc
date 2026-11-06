#!/usr/bin/env bash
# Creates/updates the PRIVATE runner repository from this folder.
# Usage: slither-worker/github-runner/setup.sh [owner/repo]   (default: <you>/solay39-slither-runner)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="${1:-$(gh api user --jq .login)/solay39-slither-runner}"
tmp="$(mktemp -d)"
gh repo view "$repo" >/dev/null 2>&1 || gh repo create "$repo" --private --description "Solay39 Slither runner (private)"
[ "$(gh repo view "$repo" --json visibility --jq .visibility)" = "PRIVATE" ] || { echo "ERROR: $repo must be private"; exit 1; }
git clone -q "https://github.com/$repo.git" "$tmp/r" 2>/dev/null || mkdir -p "$tmp/r"
cd "$tmp/r"; git init -q -b main 2>/dev/null || true
cp "$here/app.py" "$here/run_job.py" "$here/requirements.txt" .
mkdir -p .github/workflows && cp "$here/github-runner/analyze.yml" .github/workflows/analyze.yml
printf '# Solay39 Slither runner\n\nPrivate. Generated from `slither-worker/` of the main repo — do not edit here.\n' > README.md
git add -A
git -c user.name="$(git -C "$here" config user.name)" -c user.email="$(git -C "$here" config user.email)" \
  commit -qm "Sync runner from slither-worker" || echo "Nothing to update"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$repo.git"
git push -q -u origin main
echo "Runner ready: https://github.com/$repo"
