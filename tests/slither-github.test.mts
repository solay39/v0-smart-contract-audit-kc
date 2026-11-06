// GitHub Actions runner (lib/slither-github.ts) with a mocked GitHub API.
import { test } from "node:test"
import assert from "node:assert/strict"
import { gunzipSync } from "node:zlib"
import { readFileSync } from "node:fs"
import { zipSync, strToU8 } from "fflate"
import { runSlither } from "../lib/slither-client.ts"
import { encodeSlitherPayload } from "../lib/slither-github.ts"

const fx = JSON.parse(readFileSync(new URL("./fixtures/slither-results.json", import.meta.url), "utf8"))

function mockGitHub(opts: { conclusion?: string; neverCompletes?: boolean } = {}) {
  const calls: { method: string; url: string; auth: string | null; body?: any }[] = []
  let polls = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input)
    const method = init.method ?? "GET"
    const auth = new Headers(init.headers).get("authorization")
    calls.push({ method, url, auth, body: init.body ? JSON.parse(init.body) : undefined })
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (url.endsWith("/dispatches")) return json({ workflow_run_id: 7, html_url: "https://github.com/o/r/actions/runs/7" })
    if (method === "DELETE") return new Response(null, { status: 204 })
    if (url.endsWith("/cancel")) return new Response(null, { status: 202 })
    if (url.endsWith("/actions/runs/7")) {
      polls++
      if (opts.neverCompletes || polls < 2) return json({ status: "in_progress", conclusion: null })
      return json({ status: "completed", conclusion: opts.conclusion ?? "success" })
    }
    if (url.includes("/actions/runs/7/artifacts")) {
      return json({ artifacts: [{ id: 99, archive_download_url: "https://api.github.com/repos/o/r/actions/artifacts/99/zip" }] })
    }
    if (url.endsWith("/artifacts/99/zip")) return new Response(null, { status: 302, headers: { location: "https://blob.example/signed" } })
    if (url === "https://blob.example/signed") {
      return new Response(zipSync({ "result.json": strToU8(JSON.stringify(fx.reentrant.result)) }), { status: 200 })
    }
    return json({ message: "unexpected " + url }, 500)
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = realFetch } }
}

function withEnv(fn: () => Promise<void>) {
  return async () => {
    const saved = { ...process.env }
    delete process.env.SLITHER_WORKER_URL
    process.env.SLITHER_GITHUB_TOKEN = "tkn"
    process.env.SLITHER_GITHUB_REPO = "o/r"
    try { await fn() } finally { process.env = saved }
  }
}

test("payload encoding round-trips (gzip+base64)", () => {
  const req = { code: fx.reentrant.code, contractName: "Bank" }
  const decoded = JSON.parse(gunzipSync(Buffer.from(encodeSlitherPayload(req), "base64")).toString())
  assert.deepEqual(decoded, req)
})

test("GitHub runner: dispatch, poll, download, cleanup", withEnv(async () => {
  const m = mockGitHub()
  try {
    const r = await runSlither({ code: fx.reentrant.code, contractName: "Bank" }, 30_000)
    assert.equal(r.status, "ok")
    assert.equal(r.runner, "github-actions")
    assert.ok(r.findings.some((f) => f.check === "reentrancy-eth"))
    const dispatch = m.calls.find((c) => c.url.endsWith("/dispatches"))!
    assert.equal(dispatch.body.return_run_details, true)
    assert.equal(dispatch.body.ref, "main")
    assert.match(dispatch.body.inputs.job_id, /^[0-9a-f-]{36}$/)
    // The GitHub token must not be sent to the signed storage URL.
    assert.equal(m.calls.find((c) => c.url === "https://blob.example/signed")!.auth, null)
    // Artifact and run (which holds the source in its inputs) are deleted.
    assert.ok(m.calls.some((c) => c.method === "DELETE" && c.url.endsWith("/actions/artifacts/99")))
    assert.ok(m.calls.some((c) => c.method === "DELETE" && c.url.endsWith("/actions/runs/7")))
  } finally { m.restore() }
}))

test("GitHub runner: failed run is reported and still cleaned up", withEnv(async () => {
  const m = mockGitHub({ conclusion: "failure" })
  try {
    const r = await runSlither({ code: "pragma solidity ^0.8.0; contract A {}" }, 30_000)
    assert.equal(r.status, "error")
    assert.match(r.error!, /failure/)
    assert.ok(m.calls.some((c) => c.method === "DELETE" && c.url.endsWith("/actions/runs/7")))
  } finally { m.restore() }
}))

test("GitHub runner: timeout cancels the run", withEnv(async () => {
  const m = mockGitHub({ neverCompletes: true })
  try {
    const r = await runSlither({ code: "pragma solidity ^0.8.0; contract A {}" }, 4_000)
    assert.equal(r.status, "timeout")
    assert.ok(m.calls.some((c) => c.url.endsWith("/actions/runs/7/cancel")))
  } finally { m.restore() }
}))

test("GitHub runner: oversized source is rejected before dispatch", withEnv(async () => {
  const m = mockGitHub()
  try {
    const big = Array.from({ length: 40_000 }, () => Math.random().toString(36)).join("\n")
    const r = await runSlither({ code: big }, 30_000)
    assert.equal(r.status, "error")
    assert.match(r.error!, /too large/)
    assert.equal(m.calls.length, 0)
  } finally { m.restore() }
}))
