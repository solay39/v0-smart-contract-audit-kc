#!/usr/bin/env bash
set -euo pipefail

# Installa Foundry (forge & cast) in modo idempotente.
# Uso: ./scripts/install_foundry.sh

FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
export PATH="$FOUNDRY_BIN:$PATH"

# foundryup may leave binaries in a version directory when activation checks
# fail on one optional tool. Discover that directory before reinstalling.
if ! command -v forge >/dev/null 2>&1; then
  VERSION_DIR="$(find "$HOME/.foundry/versions/foundry-rs/foundry" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -V | tail -n 1)"
  if [ -n "$VERSION_DIR" ] && [ -x "$VERSION_DIR/forge" ]; then
    export PATH="$VERSION_DIR:$PATH"
    for tool in forge cast anvil chisel; do
      if [ -x "$VERSION_DIR/$tool" ]; then
        ln -sf "$VERSION_DIR/$tool" "$FOUNDRY_BIN/$tool"
      fi
    done
  fi
fi

if command -v forge >/dev/null 2>&1; then
  echo "Foundry gia' installato:"
  forge --version
  exit 0
fi

curl -fsSL https://foundry.paradigm.xyz | bash

# The installer updates shell profiles, but those files are not loaded in every
# CI shell. Keep the toolchain path explicit for this process.
export PATH="$FOUNDRY_BIN:$PATH"

if ! command -v foundryup >/dev/null 2>&1; then
  echo "foundryup non trovato dopo l'installazione" >&2
  exit 1
fi
if ! foundryup; then
  echo "Avviso: foundryup non ha completato la verifica di tutti i binari; provo comunque forge." >&2
fi

export PATH="$FOUNDRY_BIN:$PATH"
if ! command -v forge >/dev/null 2>&1; then
  VERSION_DIR="$(find "$HOME/.foundry/versions/foundry-rs/foundry" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -V | tail -n 1)"
  if [ -n "$VERSION_DIR" ] && [ -x "$VERSION_DIR/forge" ]; then
    export PATH="$VERSION_DIR:$PATH"
  fi
fi
if ! command -v forge >/dev/null 2>&1; then
  echo "forge non trovato dopo l'installazione" >&2
  exit 1
fi
echo "Foundry installato:"
forge --version

# Export for GitHub Actions and other parent orchestration shells.
if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "$FOUNDRY_BIN" >> "$GITHUB_PATH"
  if [ -n "${VERSION_DIR:-}" ]; then
    printf '%s\n' "$VERSION_DIR" >> "$GITHUB_PATH"
  fi
fi
