import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
const origin = process.env.SKYNET_PREVIEW_ORIGIN || "http://127.0.0.1:3030"
const out = ".local/skynet-public-qa"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: "chromium" })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
})
const page = await context.newPage(),
  errors: string[] = [],
  checks: string[] = []
page.on("pageerror", (e) => errors.push(e.message))
page.setDefaultTimeout(30000)
try {
  await page.goto(origin, { waitUntil: "domcontentloaded" })
  await page.getByRole("heading", { name: "Panoramica", exact: true }).waitFor()
  await page.getByTestId("result-count").waitFor()
  const loaded = await page.getByTestId("result-count").innerText()
  assert.ok(/\d+ di \d+ record/.test(loaded))
  await page.screenshot({ path: out + "/Solay39-Skynet-desktop.png" })
  checks.push(
    "Real public catalog snapshot loads, overview and actual project logos"
  )
  await page.getByTestId("nav-networks").click()
  await page.screenshot({ path: out + "/networks-desktop.png" })
  await page.getByTestId("network-card-BSC").click()
  await page.getByRole("button", { name: "Azzera filtri" }).click()
  await page.getByTestId("search-projects").fill("Tagger")
  const popup = page.waitForEvent("popup")
  await page.getByTestId("report-tagger-1793148483876").first().click()
  const report = await popup
  await report.waitForLoadState("domcontentloaded")
  assert.equal(new URL(report.url()).pathname, "/audit/tagger-1793148483876")
  const logo = report.getByAltText("Tagger logo", { exact: true })
  await logo.waitFor()
  await logo.evaluate((i: HTMLImageElement) => i.decode())
  assert.ok(await logo.evaluate((i: HTMLImageElement) => i.naturalWidth > 0))
  await report.getByRole("button", { name: "HIGH (1)", exact: true }).click()
  await report.getByRole("button", { name: "All (4)", exact: true }).click()
  for (const title of [
    "Delegatecall Usage",
    "Floating Pragma Version",
    "Fixed Supply (Constructor-Only Mint)",
    "Initial Supply Concentration",
  ]) {
    await report.getByText(title, { exact: true }).first().waitFor()
  }
  const summary = report
    .locator("summary")
    .filter({ hasText: "Inspect submitted PoC code" })
    .first()
  await summary.click()
  assert.equal(
    await summary.evaluate(
      (el) => (el.parentElement as HTMLDetailsElement).open
    ),
    true
  )
  await summary.click()
  const downloadPromise = report.waitForEvent("download")
  await report
    .getByRole("button", { name: "Download technical report", exact: true })
    .click()
  const download = await downloadPromise
  await download.saveAs(out + "/Tagger-technical-report.md")
  const hash = createHash("sha256")
    .update(await readFile(out + "/Tagger-technical-report.md"))
    .digest("hex")
  assert.equal(
    hash,
    "afeae626ba8769d960e44dd4d35e3051e64020323dd5302dca811a9e500ac736"
  )
  checks.push(
    "Real report link click, Tagger logo, four findings, filter/disclosure cycle and byte-identical Markdown export"
  )
  await report.close()
  await page.getByRole("button", { name: "Azzera filtri" }).click()
  await page.getByTestId("nav-overview").click()
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.keyboard.press("Control+Home")
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    )
    await page.screenshot({ path: `${out}/Solay39-Skynet-mobile-${width}.png` })
    await page.getByRole("button", { name: "Apri menu" }).click()
    await page.getByTestId("nav-directory").click()
    await page.getByTestId("search-projects").fill("tagger-1793148483876")
    await page.getByTestId("result-count").filter({ hasText: "1 di" }).waitFor()
    await page.screenshot({ path: `${out}/directory-${width}.png` })
    await page.getByRole("button", { name: "Azzera filtri" }).click()
    await page.getByRole("button", { name: "Apri menu" }).click()
    await page.getByTestId("nav-methodology").click()
    await page.screenshot({ path: `${out}/methodology-${width}.png` })
    await page.getByRole("button", { name: "Apri menu" }).click()
    await page.getByTestId("nav-overview").click()
  }
  checks.push(
    "Actual 375/320px catalog, mobile menu navigation, search/reset and methodology, no horizontal overflow"
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByTestId("nav-directory").click()
  await page.getByTestId("search-projects").fill("Tagger")
  await page.screenshot({ path: out + "/directory-desktop.png" })
  // A JS string avoids tsx's named-function helper leaking into browser serialization.
  const contrast = (await page.evaluate(`(() => {
    const lum = (rgb) => {
      const parts = rgb.match(/[0-9.]+/g).slice(0, 3).map(Number).map(v => { const x = v / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4 })
      return .2126 * parts[0] + .7152 * parts[1] + .0722 * parts[2]
    }
    return [...document.querySelectorAll("small, th, td code, [class*=badge], [class*=capture], [class*=navLabel]")]
      .filter(el => el.getBoundingClientRect().width > 0).map(el => {
        const fg = getComputedStyle(el).color
        let p = el, bg = "rgb(255,255,255)"
        while (p) { const v = getComputedStyle(p).backgroundColor; if (v !== "rgba(0, 0, 0, 0)") { bg = v; break }; p = p.parentElement }
        const a = lum(fg), b = lum(bg)
        return { label: el.textContent?.slice(0, 40), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
      })
  })()`)) as Array<{ label?: string; ratio: number }>
  assert.ok(
    contrast.every((c) => c.ratio >= 4.5),
    JSON.stringify(contrast.filter((c) => c.ratio < 4.5))
  )
  checks.push(
    "Rendered small/secondary/status labels meet 4.5:1 measured contrast"
  )
  assert.deepEqual(errors, [])
  await writeFile(
    out + "/results.json",
    JSON.stringify(
      {
        origin,
        loaded,
        checks,
        pageErrors: errors,
        exportSha256: hash,
        contrast,
      },
      null,
      2
    )
  )
  console.log(
    JSON.stringify(
      { origin, loaded, checks, pageErrors: errors, exportSha256: hash },
      null,
      2
    )
  )
} finally {
  await browser.close()
}
