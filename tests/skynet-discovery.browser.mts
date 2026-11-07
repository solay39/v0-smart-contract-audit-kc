import { chromium } from "playwright"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"

const origin = process.env.SKYNET_QA_ORIGIN || "http://127.0.0.1:3020"
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("Fixture QA is local-only")
const out = ".local/skynet-qa"
await mkdir(out, { recursive: true })
const fixture = Array.from({ length: 26 }, (_, i) => ({
  id: `fixture-${i}`,
  name: i === 0 ? "Tagger fixture" : `Protocol ${String(i).padStart(2, "0")}`,
  ticker: i === 0 ? "TAG" : `P${i}`,
  network: i % 2 ? "Ethereum" : "BSC",
  date: `2026-10-${String((i % 26) + 1).padStart(2, "0")}`,
  contractAddress: `0xfixture${i}`,
  score: 99,
  rating: "AAA",
  findings: [{ severity: i % 2 ? "HIGH" : "INFO" }],
  logoUrl:
    i === 0
      ? "https://coin-images.coingecko.com/missing-fixture.png"
      : undefined,
}))
const browser = await chromium.launch({ headless: true, channel: "chromium" })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
const page = await context.newPage()
const checks: string[] = [],
  errors: string[] = []
page.on("pageerror", (e) => errors.push(e.message))
page.setDefaultTimeout(20000)
async function assertEnglish() {
  const ui = page.getByTestId("skynet-discovery")
  const labels = await ui
    .locator("[aria-label], input[placeholder]")
    .evaluateAll((elements) =>
      elements
        .flatMap((el) => [
          el.getAttribute("aria-label"),
          el.getAttribute("placeholder"),
        ])
        .filter(Boolean)
        .join(" ")
    )
  assert.doesNotMatch(
    (await ui.innerText()) + labels,
    /Panoramica|Tutti i report|Ultimi report|Metodologia|Preliminare|dichiarat|Azzera|Riprova|Caricamento|Cerca progetti|Apri menu|Chiudi menu|Pagina|Filtra per rete|Ordina report/
  )
}
await page.route(
  "https://coin-images.coingecko.com/missing-fixture.png",
  (route) => route.abort()
)
let response: "ok" | "error" | "empty" | "invalid" = "ok"
let release: (() => void) | undefined
let held: Promise<void> | null = new Promise((resolve) => {
  release = resolve
})
await page.route("**/api/audits", async (route) => {
  if (held) await held
  await route.fulfill({
    status: response === "error" ? 503 : 200,
    contentType: "application/json",
    body: JSON.stringify(
      response === "invalid"
        ? { audits: {} }
        : { audits: response === "empty" ? [] : fixture }
    ),
  })
})
try {
  await page.goto(origin + "/skynet", { waitUntil: "domcontentloaded" })
  await page.getByRole("status", { name: "Loading directory" }).waitFor()
  await page.screenshot({ path: `${out}/loading.png` })
  release?.()
  held = null
  await page
    .getByTestId("result-count")
    .filter({ hasText: "26 of 26" })
    .waitFor()
  assert.equal(await page.locator("tbody tr").count(), 12)
  await assertEnglish()
  await page.getByText("Preliminary", { exact: true }).first().waitFor()
  await page.getByPlaceholder("Search project, token or address").waitFor()
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await page.getByText("Page 2 of 3", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Previous page", exact: true }).click()
  await page.getByText("Page 1 of 3", { exact: true }).waitFor()
  checks.push(
    "Loading skeleton, pagination forward/back and disabled boundaries"
  )
  await page.keyboard.press("/")
  assert.equal(
    await page
      .getByTestId("search-projects")
      .evaluate((el) => el === document.activeElement),
    true
  )
  await page.keyboard.type("TAG")
  await page
    .getByTestId("result-count")
    .filter({ hasText: "1 of 26" })
    .waitFor()
  assert.ok(
    (await page.locator("tbody").innerText()).includes("Tagger fixture")
  )
  await page
    .getByRole("img", {
      name: "Tagger fixture: logo unavailable",
      exact: true,
    })
    .first()
    .waitFor()
  assert.ok(!(await page.locator("tbody").innerText()).includes("AAA"))
  await page
    .getByRole("combobox", { name: "Filter by network" })
    .selectOption("Ethereum")
  await page
    .getByRole("heading", { name: "No reports match your search" })
    .waitFor()
  await page.getByRole("button", { name: "Clear search", exact: true }).click()
  await page
    .getByTestId("result-count")
    .filter({ hasText: "26 of 26" })
    .waitFor()
  await page
    .getByRole("combobox", { name: "Filter by network" })
    .selectOption("BSC")
  await page
    .getByTestId("result-count")
    .filter({ hasText: "13 of 26" })
    .waitFor()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await page
    .getByRole("combobox", { name: "Sort reports" })
    .selectOption("findings")
  await page
    .getByRole("combobox", { name: "Sort reports" })
    .selectOption("name")
  checks.push(
    "Keyboard search, name/ticker lookup, combined filter/empty/reset and sort cycle"
  )
  await page.getByTestId("nav-networks").click()
  await page.getByTestId("network-card-Ethereum").click()
  await page
    .getByTestId("result-count")
    .filter({ hasText: "13 of 26" })
    .waitFor()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await page.getByTestId("nav-overview").click()
  await page.getByTestId("board-BSC").click()
  await page
    .getByTestId("result-count")
    .filter({ hasText: "13 of 26" })
    .waitFor()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await page.getByTestId("nav-recent").click()
  assert.equal(
    await page.getByRole("combobox", { name: "Sort reports" }).isDisabled(),
    true
  )
  assert.ok(
    (await page.locator("tbody tr").first().innerText()).includes("Protocol 25")
  )
  await page.getByTestId("nav-methodology").click()
  await page
    .getByRole("heading", { name: "What this directory means" })
    .waitFor()
  await assertEnglish()
  await page.getByTestId("search-projects").fill("0xfixture0")
  await page
    .getByTestId("result-count")
    .filter({ hasText: "1 of 26" })
    .waitFor()
  assert.ok(
    (await page.locator("tbody tr").innerText()).includes("Tagger fixture")
  )
  checks.push(
    "All navigation views, network boards, recent ordering and address search from methodology"
  )
  await page.getByRole("button", { name: "Collapse sidebar" }).click()
  assert.equal(
    await page
      .getByRole("button", { name: "Expand sidebar" })
      .getAttribute("aria-expanded"),
    "false"
  )
  await page.getByRole("button", { name: "Expand sidebar" }).click()
  await page.setViewportSize({ width: 375, height: 900 })
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("dialog").waitFor()
  await page.keyboard.press("Shift+Tab")
  assert.equal(
    await page
      .getByTestId("classic-view")
      .evaluate((el) => el === document.activeElement),
    true
  )
  await page.keyboard.press("Tab")
  assert.equal(
    await page
      .getByRole("button", { name: "Close menu", exact: true })
      .evaluate((el) => el === document.activeElement),
    true
  )
  await page.keyboard.press("Escape")
  assert.equal(
    await page
      .getByRole("button", { name: "Open menu" })
      .getAttribute("aria-expanded"),
    "false"
  )
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByTestId("nav-networks").click()
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole("dialog").waitFor({ state: "detached" })
  checks.push(
    "Sidebar collapse cycle, mobile drawer/Escape/focus and mobile-to-desktop recovery"
  )
  await page.getByTestId("nav-directory").click()
  await page.getByRole("button", { name: "Clear filters" }).click()
  response = "error"
  await page.getByRole("button", { name: "Refresh directory" }).click()
  await page.getByTestId("skynet-discovery").getByRole("alert").waitFor()
  await assertEnglish()
  assert.equal(await page.locator("tbody tr").count(), 12)
  response = "ok"
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await page
    .getByTestId("skynet-discovery")
    .getByRole("alert")
    .waitFor({ state: "detached" })
  response = "error"
  await page.reload()
  await page.getByRole("heading", { name: "Directory unavailable" }).waitFor()
  response = "invalid"
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await page.getByRole("heading", { name: "Directory unavailable" }).waitFor()
  response = "empty"
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await page
    .getByRole("heading", { name: "No public reports available" })
    .waitFor()
  response = "ok"
  await page.getByRole("button", { name: "Refresh directory" }).click()
  await page
    .getByTestId("result-count")
    .filter({ hasText: "26 of 26" })
    .waitFor()
  checks.push(
    "Failed refresh preserves stale data, retry, first-load error, malformed payload and empty catalog"
  )
  for (const width of [1440, 375, 320, 720]) {
    await page.setViewportSize({ width, height: width === 720 ? 500 : 1000 })
    await page.getByTestId("search-projects").fill("TAG")
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    )
    await page.screenshot({ path: `${out}/directory-${width}.png` })
    if (width <= 375) {
      await page.getByRole("button", { name: "Open menu" }).click()
      await page.getByTestId("nav-methodology").click()
      await page.screenshot({ path: `${out}/methodology-${width}.png` })
    }
  }
  checks.push(
    "1440/375/320 and 720x500 (200% equivalent) have no horizontal overflow"
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(origin)
  await page
    .getByRole("button", { name: "View Ratings", exact: true })
    .first()
    .click()
  await page.getByTestId("skynet-discovery").waitFor()
  await page.getByTestId("classic-view").click()
  await page
    .locator('input[placeholder="Search protocol..."]:visible')
    .first()
    .waitFor()
  checks.push(
    "Landing View Ratings opens new view, classic escape hatch preserved"
  )
  await page.goto(origin + "/leaderboard")
  await page.getByTestId("skynet-discovery").waitFor()
  await page.getByTestId("back-home").click()
  await page
    .getByRole("button", { name: "Founder Access", exact: true })
    .first()
    .click()
  await page.locator('input[type="password"]').waitFor()
  assert.equal(
    (
      await context.request.get(origin + "/api/founder/historical-reviews")
    ).status(),
    401
  )
  const privatePage = await context.request.get(
    origin + "/founder/historical-reviews",
    { maxRedirects: 0 }
  )
  assert.equal(privatePage.status(), 307)
  checks.push(
    "Existing leaderboard entry, return home, founder login and anonymous historical access protection"
  )
  await page.goto(origin + "/audit/chz-token")
  await page.getByTestId("project-profile").waitFor()
  await page.getByRole("heading", { name: "chiliZ", exact: true }).waitFor()
  await page
    .getByRole("button", { name: "Full technical report", exact: true })
    .click()
  await page.locator('.s39-report[data-report-appearance="classic"]').waitFor()
  await page
    .getByRole("button", { name: "Back to project profile", exact: true })
    .click()
  await page.getByRole("link", { name: "All projects", exact: true }).click()
  await page.getByTestId("skynet-discovery").waitFor()
  checks.push(
    "Canonical /audit/chz-token uses project profile, classic report switch and return to real directory"
  )
  assert.deepEqual(errors, [])
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      { fixtureOnly: true, writes: 0, checks, pageErrors: errors },
      null,
      2
    )
  )
  console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2))
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true })
  await writeFile(
    `${out}/failure.json`,
    JSON.stringify(
      { url: page.url(), pageErrors: errors, error: String(error) },
      null,
      2
    )
  )
  throw error
} finally {
  await browser.close()
}
