#!/usr/bin/env node
const { spawnSync } = require("node:child_process")
const result = spawnSync(process.execPath, ["scripts/validate-dir.mjs", ...process.argv.slice(2)], { stdio: "inherit" })
process.exit(result.status ?? 1)
