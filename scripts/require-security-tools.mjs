#!/usr/bin/env node
import { spawnSync } from "node:child_process"

const requiredTools = [
  ["slither", ["--version"]],
  ["myth", ["version"]],
]
let failed = false

for (const [name, args] of requiredTools) {
  const result = spawnSync(name, args, { encoding: "utf8", timeout: 15_000, shell: false })
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  if (result.error || result.status !== 0 || !output.trim()) {
    failed = true
    console.error(`[SECURITY GATE FAILED] ${name}: unavailable or unusable`)
  } else {
    console.log(`[SECURITY GATE OK] ${name}`)
  }
}

if (failed) {
  console.error("Audit blocked: required security tools are not operational.")
  process.exit(1)
}
