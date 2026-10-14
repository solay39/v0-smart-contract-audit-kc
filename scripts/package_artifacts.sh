#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p artifacts
[[ -d reports ]] && cp -R reports artifacts/reports || true
export PATH="$HOME/.foundry/bin:$HOME/.local/bin:$PATH"
if command -v forge >/dev/null 2>&1; then forge build; cp -R out artifacts/out || true; fi
archive="artifacts/solay39_security_package_$(date -u +%Y%m%dT%H%M%SZ).zip"
if command -v zip >/dev/null 2>&1; then zip -qr "$archive" artifacts/reports artifacts/out 2>/dev/null || zip -qr "$archive" artifacts/reports; else tar -czf "${archive%.zip}.tar.gz" artifacts; fi
echo "Package created: $archive"
