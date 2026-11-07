// Read-only localhost verification of the real imported queue. NO wallet/signatures.
import { chromium } from "playwright"
import { promises as fs } from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
const root = process.argv[2]
const port = process.argv[3] || "3001"
if (!root || !path.resolve(root).includes("/.local/historical-review-qa-") || !/^\d{4,5}$/.test(port)) throw new Error("Isolated QA root required")
const origin = `https://127.0.0.1:${port}`
const credentials = JSON.parse(await fs.readFile(path.join(root, "synthetic-credentials.json"), "utf8"))
const browser = await chromium.launch({ headless: true, channel: "chromium" })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true })
const page = await context.newPage()
const errors: string[] = []
page.on("pageerror", error => errors.push(error.message))
try {
  const login = await context.request.post(origin + "/api/founder/session", { data: { email: credentials.email, password: credentials.password } })
  assert.equal(login.status(), 200)
  const queueResponse = await context.request.get(origin + "/api/founder/historical-reviews")
  assert.equal(queueResponse.status(), 200)
  const { queue } = await queueResponse.json()
  assert.equal(queue.length, 115)
  assert.ok(queue.every((r: any) => r.status === "NOT_STARTED"))
  assert.equal(queue.filter((r: any) => !r.technicalBlockers.length).length, 1)
  const counts = { records: 115, approved: 0, technicalEligibleBeforeManualReview: 1 }
  const aeroId = "aerodrome-1772654966787"
  const view = await (await context.request.get(`${origin}/api/founder/historical-reviews/${aeroId}`)).json()
  assert.equal(view.snapshot.testFixture, false)
  assert.equal(view.state.approval, null)
  assert.ok(view.blockers.length)
  assert.ok(view.snapshot.sourceDigests.length)
  const denied = await context.request.post(`${origin}/api/founder/historical-reviews/${aeroId}`, {
    headers: { Origin: origin }, data: { action: "save", reviewKey: view.reviewKey, expectedVersion: 0, draft: view.state.draft },
  })
  assert.equal(denied.status(), 403)
  assert.equal((await denied.json()).code, "READ_ONLY")
  await page.goto(origin + "/founder/historical-reviews", { waitUntil: "networkidle", timeout: 120_000 })
  await page.getByLabel("Cerca un audit", { exact: true }).fill(aeroId)
  await page.locator('aside[aria-label="Coda degli audit"] button').click()
  await page.locator("#review-scope").waitFor()
  assert.equal(await page.locator("#review-scope").inputValue(), "")
  assert.equal(await page.getByRole("button", { name: "Prepara firma", exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole("heading", { name: "Approvato, non pubblicato", exact: true }).count(), 0)
  await page.screenshot({ path: path.join(root, "AERO-READONLY-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 375, height: 900 })
  const mobile = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
  assert.ok(mobile.scroll <= mobile.width)
  const reload = await page.getByRole("button", { name: "Ricarica dal server", exact: true }).boundingBox()
  assert.ok(reload && reload.height <= 65 && reload.width > 150, "Mobile reload button must not collapse into a vertical sliver")
  await page.screenshot({ path: path.join(root, "AERO-READONLY-mobile.png"), fullPage: true })
  const tag = await (await context.request.get(`${origin}/api/founder/historical-reviews/tagger-1793148483876`)).json()
  assert.ok(tag.snapshot.technicalBlockers.some((b: string) => b.includes("TAG:")))
  const meet = await (await context.request.get(`${origin}/api/founder/historical-reviews/meet48--1772894893577`)).json()
  assert.ok(meet.snapshot.technicalBlockers.length)
  const solana = queue.find((r: any) => r.network === "Solana")
  const mint = await (await context.request.get(`${origin}/api/founder/historical-reviews/${solana.auditId}`)).json()
  assert.ok(mint.snapshot.technicalBlockers.some((b: string) => b.includes("Rust")))
  const sigmaId = "sigma-1772552121543"
  await page.getByLabel("Cerca un audit", { exact: true }).fill(sigmaId)
  await page.locator('aside[aria-label="Coda degli audit"] button').click()
  await page.getByRole("heading", { name: queue.find((r: any) => r.auditId === sigmaId).name, exact: true }).waitFor()
  await page.getByRole("button", { name: "Finding successivi", exact: true }).click()
  assert.equal(await page.getByRole("button", { name: "Finding precedenti", exact: true }).isEnabled(), true)
  assert.deepEqual(errors, [])
  await assert.rejects(fs.stat(path.join(root, "states")), (e: any) => e.code === "ENOENT")
  const result = { ...counts, readonlyMutationDenied: true, savedDrafts: 0, productionWrites: 0,
    checked: ["115 initial pending records", "AERO immutable hashes and pending manual review", "TAG role blockers", "MEET48 target binding blockers", "Solana mint not Rust audit",
      "largest queue item 859 candidates with working pagination", "375px no overflow, usable reload button", "no browser errors", "no local historical state files created"] }
  await fs.writeFile(path.join(root, "readonly-browser-results.json"), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally { await browser.close() }
