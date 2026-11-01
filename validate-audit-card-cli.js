#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")
const Ajv2020 = require("ajv/dist/2020")
const addFormats = require("ajv-formats")
const { spawnSync } = require("node:child_process")
const file = process.argv[2]
if (!file) { console.error("Usage: node validate-audit-card-cli.js <card.json>"); process.exit(1) }
const fullPath = path.resolve(file)
if (!fs.existsSync(fullPath)) { console.error(`File not found: ${fullPath}`); process.exit(1) }
const card = JSON.parse(fs.readFileSync(fullPath, "utf8")); const schema = JSON.parse(fs.readFileSync(path.resolve("audit-card.schema.json"), "utf8")); const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv); const validate = ajv.compile(schema); const errors = validate(card) ? [] : (validate.errors || []).map((error) => `schema: ${error.message} at ${error.instancePath || "/"}`)
const semantic = spawnSync(process.execPath, ["validate-audit-card.js", fullPath], { encoding: "utf8" }); if (semantic.status !== 0 && semantic.stdout) errors.push(...semantic.stdout.trim().split("\n").slice(1)); if (semantic.status !== 0 && semantic.stderr) errors.push(...semantic.stderr.trim().split("\n").filter(Boolean).slice(1))
if (errors.length) { console.error("Audit card validation failed:"); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1) }; console.log("Audit card validation passed.")
