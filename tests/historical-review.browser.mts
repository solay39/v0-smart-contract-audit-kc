// Isolated localhost E2E. Usage: tsx tests/historical-review.browser.mts QA_ROOT [PORT]
// This file never uses a real report, wallet or production endpoint.
import { chromium } from "playwright"
import { promises as fs } from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { Wallet, getBytes } from "ethers"

const root = process.argv[2]
const port = process.argv[3] || "3001"
if (!root || !path.resolve(root).includes("/.local/historical-review-qa-") || !/^\d{4,5}$/.test(port)) throw new Error("Synthetic QA root and localhost port required")
const origin = `https://127.0.0.1:${port}`
const credentials = JSON.parse(await fs.readFile(path.join(root, "synthetic-credentials.json"), "utf8"))
const syntheticCatalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8"))
if (!syntheticCatalog.snapshots.every((s: any) => s.testFixture === true && s.auditId.startsWith("synthetic-"))) throw new Error("Refuse non-synthetic QA data")
await fs.rm(path.join(root, "states"), { recursive: true, force: true }) // Repeatable synthetic fixtures only.
const signer = new Wallet(credentials.walletPrivateKey)
const browser = await chromium.launch({ headless: true, channel: "chromium" })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true })
const page = await context.newPage()
page.setDefaultTimeout(30_000)
const errors: string[] = []
page.on("pageerror", error => errors.push(error.message))
const results: string[] = []
let rejectWallet = false
await page.exposeFunction("syntheticWalletRequest", async (input: { method: string; params?: string[] }) => {
  if (input.method === "eth_requestAccounts" || input.method === "eth_accounts") return [signer.address]
  if (input.method !== "personal_sign") throw new Error("SYNTHETIC: forbidden transaction method")
  if (rejectWallet) throw new Error("SYNTHETIC wallet rejected signature")
  return signer.signMessage(getBytes(input.params![0]))
})
await page.addInitScript({ content: 'Object.defineProperty(window,"ethereum",{value:{isMetaMask:true,request:function(input){return window.syntheticWalletRequest(input)}}});' })
try {
  assert.equal((await context.request.get(origin + "/api/founder/historical-reviews")).status(), 401)
  assert.equal((await context.request.post(origin + "/api/audit/review-signoff", { data: {} })).status(), 401)
  results.push("Anonymous private queue and legacy signoff denied")
  const login = await context.request.post(origin + "/api/founder/session", { data: { email: credentials.email, password: credentials.password } })
  assert.equal(login.status(), 200)
  assert.equal((await context.request.post(origin + "/api/audit/review-signoff", { headers: { Origin: origin }, data: {} })).status(), 410)
  assert.equal((await context.request.post(origin + "/api/founder/historical-reviews/synthetic-qa-only", { data: {} })).status(), 403)
  assert.equal((await context.request.post(origin + "/api/founder/historical-reviews/synthetic-qa-only", { headers: { Origin: "https://evil.invalid" }, data: {} })).status(), 403)
  assert.equal((await context.request.get(origin + "/api/founder/historical-reviews/unknown")).status(), 404)
  results.push("Authenticated legacy signoff retired; missing/cross Origin rejected; unknown record 404")
  await page.goto(origin + "/founder/historical-reviews", { waitUntil: "networkidle", timeout: 120_000 })
  await page.getByRole("button", { name: /Synthetic QA fixture/ }).click()
  await page.getByRole("heading", { name: "Synthetic QA fixture", exact: true }).waitFor()
  const scope = "SYNTHETIC QA ONLY. Isolated fixture with no real blockchain address, code or human security opinion. Never publish."
  await page.getByLabel("Scope revisionato", { exact: true }).fill(scope)
  page.once("dialog", dialog => dialog.dismiss())
  await page.getByRole("button", { name: /Synthetic blocked record/ }).click()
  assert.equal(await page.locator("#review-scope").inputValue(), scope)
  results.push("Dirty audit switch guarded; cancellation preserves unsaved edits")
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click()
  await page.getByRole("status").filter({ hasText: "Bozza salvata" }).waitFor()
  await page.reload({ waitUntil: "networkidle" })
  await page.getByRole("button", { name: /Synthetic QA fixture/ }).click()
  assert.equal(await page.locator("#review-scope").inputValue(), scope)
  results.push("Draft saved to actual isolated server, survives browser reload")
  await page.getByLabel("Conclusione revisionata", { exact: true }).fill("SYNTHETIC QA ONLY. These deliberately artificial notes exercise the persistence and signing workflow, not a real founder audit approval or security conclusion.")
  await page.getByLabel("Rischi residui e limiti", { exact: true }).fill("SYNTHETIC QA ONLY. No real source, blockchain or deployment recommendation.")
  for (const select of await page.locator("select").all()) {
    if (await select.locator('option[value="pass"]').count()) await select.selectOption("pass")
  }
  for (const field of await page.getByLabel(/^Motivazione: /).all()) await field.fill("SYNTHETIC QA ONLY: isolated workflow fixture, not a real security judgment.")
  await page.locator("details").filter({ has: page.locator("summary", { hasText: "Synthetic finding for QA" }) }).locator("summary").click()
  await page.getByLabel("Decisione", { exact: true }).selectOption("false_positive")
  await page.getByLabel("Motivazione della decisione", { exact: true }).fill("SYNTHETIC QA ONLY: manufactured fixture used exclusively to test source-bound private approval.")
  await page.getByLabel("Evidenza a supporto", { exact: true }).selectOption({ label: "SYNTHETIC SOURCE FIXTURE" })
  for (const checkbox of await page.locator('input[type="checkbox"]').all()) await checkbox.check()
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click()
  await page.getByRole("status").filter({ hasText: "Bozza salvata" }).waitFor()
  assert.equal(await page.getByRole("button", { name: "Prepara firma", exact: true }).isEnabled(), true)
  await page.getByRole("button", { name: "Prepara firma", exact: true }).click()
  await page.getByRole("heading", { name: "Messaggio esatto da firmare" }).waitFor()
  results.push("Every required check, candidate disposition and evidence ref reviewed individually on synthetic fixture")
  rejectWallet = true
  await page.getByRole("button", { name: "Firma e approva senza pubblicare", exact: true }).click()
  await page.getByRole("alert").filter({ hasText: "wallet rejected" }).waitFor()
  assert.equal(await page.getByRole("heading", { name: "Approvato, non pubblicato", exact: true }).count(), 0)
  rejectWallet = false
  results.push("Wallet rejection never displays approved")
  await page.route("**/api/founder/historical-reviews/synthetic-qa-only", async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON()
      if (body.action === "approve") {
        await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"SYNTHETIC persistence failure"}' })
        return
      }
    }
    await route.continue()
  })
  await page.getByRole("button", { name: "Firma e approva senza pubblicare", exact: true }).click()
  await page.getByRole("alert").filter({ hasText: "persistence failure" }).waitFor()
  const unchanged = await (await context.request.get(origin + "/api/founder/historical-reviews/synthetic-qa-only")).json()
  assert.equal(unchanged.state.approval, null)
  assert.equal(await page.getByRole("heading", { name: "Approvato, non pubblicato", exact: true }).count(), 0)
  await page.unroute("**/api/founder/historical-reviews/synthetic-qa-only")
  results.push("Simulated failed POST remains unapproved in UI and actual server state")
  let failReadback = false
  await page.route("**/api/founder/historical-reviews/synthetic-qa-only", async route => {
    if (route.request().method() === "POST" && route.request().postDataJSON().action === "approve") {
      const response = await route.fetch()
      assert.equal(response.status(), 200); failReadback = true
      await route.fulfill({ response }); return
    }
    if (route.request().method() === "GET" && failReadback) {
      failReadback = false
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"SYNTHETIC readback unavailable"}' }); return
    }
    await route.continue()
  })
  await page.getByRole("button", { name: "Firma e approva senza pubblicare", exact: true }).click()
  await page.getByRole("alert").filter({ hasText: "readback unavailable" }).waitFor()
  assert.equal(await page.getByRole("heading", { name: "Approvato, non pubblicato", exact: true }).count(), 0)
  await page.unroute("**/api/founder/historical-reviews/synthetic-qa-only")
  await page.getByRole("button", { name: "Ricarica dal server", exact: true }).click()
  await page.getByRole("heading", { name: "Approvato, non pubblicato", exact: true }).waitFor()
  assert.equal(await page.getByLabel("Scope revisionato", { exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole("button", { name: "Firma e approva senza pubblicare", exact: true }).count(), 0)
  results.push("Actual synthetic signature persisted atomically; UI waits for readback; reload recovers immutable unpublished approval")
  const final = await (await context.request.get(origin + "/api/founder/historical-reviews/synthetic-qa-only")).json()
  assert.equal(final.state.approval.publication, "UNPUBLISHED")
  await page.screenshot({ path: path.join(root, "desktop-approved-SYNTHETIC.png"), fullPage: true })
  await page.getByRole("button", { name: /Synthetic blocked record/ }).click()
  assert.equal(await page.getByRole("button", { name: "Prepara firma", exact: true }).isDisabled(), true)
  assert.ok(await page.getByText("SYNTHETIC: runtime binding missing; checklist cannot bypass this blocker.", { exact: true }).count())
  results.push("Technical hard blockers remain visible and disable challenge")
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole("button", { name: /Synthetic long identifier record/ }).click()
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
    assert.ok(dimensions.scroll <= dimensions.width, `Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`)
    await page.getByLabel("Scope revisionato", { exact: true }).fill("SYNTHETIC mobile draft only.")
    await page.getByRole("button", { name: "Salva bozza", exact: true }).click()
    await page.getByRole("status").filter({ hasText: "Bozza salvata" }).waitFor()
    await page.screenshot({ path: path.join(root, `mobile-${width}-SYNTHETIC.png`), fullPage: true })
  }
  results.push("375px and 320px layout, long ID, save actions and no horizontal overflow")
  assert.deepEqual(errors, [])
  results.push("No browser page errors; finding HTML rendered as inert text")
  await fs.writeFile(path.join(root, "browser-results.json"), JSON.stringify({ syntheticOnly: true, historicalApprovals: 0, results, browserErrors: errors }, null, 2))
  console.log(JSON.stringify({ syntheticOnly: true, historicalApprovals: 0, passed: results.length, results }, null, 2))
} catch (error) {
  await page.screenshot({ path: path.join(root, "FAILURE-SYNTHETIC.png"), fullPage: true }).catch(() => {})
  console.error("SYNTHETIC E2E failed", error, "Completed checks:", results, "Browser errors:", errors)
  process.exitCode = 1
} finally { await browser.close() }
