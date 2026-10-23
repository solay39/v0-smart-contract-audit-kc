const test = require("node:test")
const assert = require("node:assert/strict")

function scannerStatus({ available, exitCode, findings }) {
  if (!available) return "UNAVAILABLE"
  if (exitCode === null || exitCode === undefined) return "ERROR"
  if (exitCode !== 0 && findings.length === 0) return "ERROR"
  return findings.length > 0 ? "FINDINGS" : "PASS"
}

test("does not treat an unavailable scanner as clean", () => {
  assert.equal(scannerStatus({ available: false, exitCode: 0, findings: [] }), "UNAVAILABLE")
})

test("distinguishes a clean completed scan", () => {
  assert.equal(scannerStatus({ available: true, exitCode: 0, findings: [] }), "PASS")
})

test("reports findings separately from scanner errors", () => {
  assert.equal(scannerStatus({ available: true, exitCode: 0, findings: [{ check: "reentrancy" }] }), "FINDINGS")
  assert.equal(scannerStatus({ available: true, exitCode: 1, findings: [] }), "ERROR")
})
