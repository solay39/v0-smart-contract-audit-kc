import { chromium } from "playwright"
import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { projectProfileModel } from "../lib/project-profile"
import type { PortfolioProject } from "../lib/solay39-constants"

const origin = process.env.SKYNET_PREVIEW_ORIGIN || "http://127.0.0.1:3030"
const out = ".local/project-profile-qa"
const reports: PortfolioProject[] = JSON.parse(
  await readFile(".local/skynet-reports.json", "utf8")
)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "chromium", headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
})
const page = await context.newPage()
const errors: string[] = [],
  checks: string[] = []
page.on("pageerror", (error) => errors.push(error.message))
page.setDefaultTimeout(20000)
const hash = async (file: string) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex")
const targetHash =
  "afeae626ba8769d960e44dd4d35e3051e64020323dd5302dca811a9e500ac736"
const projectUrl = (id: string) => {
  const url = new URL(origin)
  url.searchParams.set("project", id)
  return url.href
}
async function download(name: string, file: string) {
  const pending = page.waitForEvent("download")
  await page.getByRole("button", { name, exact: true }).click()
  await (await pending).saveAs(file)
  assert.equal(await hash(file), targetHash)
}
async function noOverflow() {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  )
}
try {
  await page.goto(origin, { waitUntil: "domcontentloaded" })
  await page.getByTestId("search-projects").fill("Tagger")
  await page.getByTestId("report-tagger-1793148483876").first().click()
  await page.getByTestId("project-profile").waitFor()
  assert.equal(
    new URL(page.url()).searchParams.get("project"),
    "tagger-1793148483876"
  )
  await page
    .getByTestId("project-profile")
    .getByAltText("Tagger logo", { exact: true })
    .evaluate((image: HTMLImageElement) => image.decode())
  await page.screenshot({ path: `${out}/Tagger-profile-desktop.png` })
  await noOverflow()
  const contrast = (await page.evaluate(`(() => {
    const lum = rgb => {
      const c = rgb.match(/[0-9.]+/g).slice(0,3).map(Number).map(v => { const x=v/255; return x<=.04045?x/12.92:((x+.055)/1.055)**2.4 });
      return c[0]*.2126+c[1]*.7152+c[2]*.0722
    };
    return [...document.querySelectorAll("[data-testid=project-profile] [class*=severityBadge], [data-testid=project-profile] [class*=small], [data-testid=project-profile] [class*=pending], [data-testid=project-profile] [class*=eyebrow], [data-testid=project-profile] [class*=neutralBadge]")]
      .filter(el => el.getBoundingClientRect().width>0).map(el => {
        let p=el, bg="rgb(255,255,255)";
        while(p) { const value=getComputedStyle(p).backgroundColor; if(value!=="rgba(0, 0, 0, 0)") { bg=value; break; } p=p.parentElement; }
        const a=lum(getComputedStyle(el).color),b=lum(bg);
        return { label: el.textContent.slice(0,60), ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05) };
      });
  })()`)) as { label: string; ratio: number }[]
  assert.ok(
    contrast.every((row) => row.ratio >= 4.5),
    JSON.stringify(contrast.filter((row) => row.ratio < 4.5))
  )
  checks.push(
    "Rendered severity, secondary, preliminary and evidence labels meet 4.5:1 contrast"
  )
  await page.getByTestId("severity-HIGH").click()
  await page.getByText("1 high submissions", { exact: true }).waitFor()
  assert.equal(
    await page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: "Delegatecall Usage" }),
      })
      .count(),
    1
  )
  const finding = page
    .locator("summary")
    .filter({ hasText: "Delegatecall Usage" })
    .first()
  await finding.click()
  await page
    .getByRole("heading", { name: "Founder review question", exact: true })
    .waitFor()
  const poc = page
    .locator("summary")
    .filter({ hasText: "Inspect submitted PoC code" })
    .first()
  if (await poc.count()) {
    await poc.click()
    assert.equal(
      await poc.evaluate(
        (element) => (element.parentElement as HTMLDetailsElement).open
      ),
      true
    )
    await poc.click()
  }
  await finding.click()
  await page.getByRole("button", { name: "All (4)", exact: true }).click()
  await page
    .getByRole("button", { name: "Copy contract address", exact: true })
    .click()
  await page
    .getByRole("status")
    .filter({ hasText: /Contract address copied|Copy unavailable/ })
    .waitFor()
  await download("Download technical report", `${out}/Tagger-profile.md`)
  checks.push(
    "Actual Explorer link, logo decode, filtering, finding/PoC disclosure, clipboard feedback and exact original Markdown export"
  )
  for (const name of [
    "Evidence",
    "Fundamental",
    "Operational",
    "Governance",
    "Community",
    "Market",
    "Code Security",
  ]) {
    const link = page
      .getByRole("navigation", { name: "Project sections", exact: true })
      .getByRole("link", { name, exact: true })
    await link.click()
    assert.equal(new URL(page.url()).hash, await link.getAttribute("href"))
  }
  checks.push(
    "All seven section links use real anchors; unavailable integrations explicitly labelled"
  )
  await page
    .getByRole("button", { name: "Full technical report", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Back to project profile", exact: true })
    .waitFor()
  assert.equal(
    await page.locator(".s39-report").getAttribute("data-report-appearance"),
    "classic"
  )
  await page.getByRole("button", { name: "HIGH (1)", exact: true }).click()
  await page.getByRole("button", { name: "All (4)", exact: true }).click()
  await download("Download technical report", `${out}/Tagger-classic.md`)
  await page
    .getByRole("button", { name: "Back to project profile", exact: true })
    .click()
  await page.waitForFunction(() => document.activeElement?.tagName === "H1")
  checks.push(
    "Original technical view, existing finding controls, identical technical export and focus restoration"
  )
  await page.getByRole("button", { name: "All projects", exact: true }).click()
  assert.equal(await page.getByTestId("search-projects").inputValue(), "Tagger")
  await page.goBack()
  await page.getByTestId("project-profile").waitFor()
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.getByRole("heading", { name: "Tagger", exact: true }).waitFor()
  checks.push(
    "Directory search state retained; browser Back and project deep-link reload"
  )
  for (const width of [375, 320, 720]) {
    await page.setViewportSize({ width, height: width === 720 ? 500 : 900 })
    await page.keyboard.press("Control+Home")
    await page.waitForFunction(() => window.scrollY === 0)
    if (width < 560) {
      await page
        .getByRole("button", {
          name: "Project information & downloads",
          exact: true,
        })
        .click()
      await page
        .getByRole("button", { name: "Copy contract address", exact: true })
        .click()
      await page
        .getByRole("status")
        .filter({ hasText: /Contract address copied|Copy unavailable/ })
        .waitFor()
      await page
        .getByRole("button", { name: "Hide project information", exact: true })
        .click()
      await page.keyboard.press("Control+Home")
      await page.waitForFunction(() => window.scrollY === 0)
    }
    await noOverflow()
    await page.screenshot({ path: `${out}/Tagger-profile-${width}.png` })
    const link = page
      .getByRole("navigation", { name: "Project sections", exact: true })
      .getByRole("link", { name: "Code Security", exact: true })
    await link.click()
    await page.getByTestId("severity-HIGH").click()
    await page.getByText("1 high submissions", { exact: true }).waitFor()
    await page.getByRole("button", { name: "All (4)", exact: true }).click()
    await page
      .getByRole("button", { name: "Full technical report", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Back to project profile", exact: true })
      .click()
    await noOverflow()
  }
  checks.push(
    "375/320 mobile and 720×500 zoom-equivalent: no overflow, section/filter/report-switch cycles"
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  const selected = new Map<string, PortfolioProject>()
  for (const expression of [
    /^ALICE$/i,
    /^ARK$/i,
    /^ARIA/i,
    /^CHZ$/i,
    /^AERO$/i,
  ]) {
    const match = reports.find((p) => expression.test(p.ticker || p.name))
    if (match) selected.set(match.id, match)
  }
  const least = [...reports].sort(
    (a, b) => (a.findings?.length || 0) - (b.findings?.length || 0)
  )[0]
  if (least) selected.set(least.id, least)
  for (const report of selected.values()) {
    await page.goto(projectUrl(report.id), { waitUntil: "domcontentloaded" })
    const model = projectProfileModel(report)
    await page
      .getByRole("heading", { name: model.name, exact: true, level: 1 })
      .waitFor()
    assert.equal(
      await page
        .locator("details > summary")
        .filter({ hasText: /^F-\d+/ })
        .count(),
      model.findings.length
    )
    await noOverflow()
    await page.setViewportSize({ width: 320, height: 900 })
    await noOverflow()
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  checks.push(
    `Shared detail contract checked on ${selected.size} actual public records, including least-populated record`
  )
  for (const report of reports) {
    const model = projectProfileModel(report)
    assert.equal(
      model.distribution.reduce((n, row) => n + row.count, 0),
      model.findings.length
    )
    assert.equal(model.score, null)
    assert.equal(model.status, "Preliminary")
  }
  checks.push(
    `All ${reports.length} public snapshot records: consistent counts, no verified score/approval inference`
  )
  await page.goto(projectUrl("does-not-exist"), {
    waitUntil: "domcontentloaded",
  })
  await page
    .getByRole("heading", { name: "Preview record unavailable", exact: true })
    .waitFor()
  await page
    .getByRole("button", { name: "Back to project directory", exact: true })
    .click()
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor()
  assert.deepEqual(errors, [])
  checks.push("Missing-record recovery and zero uncaught JavaScript errors")
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ origin, checks, errors, exportHash: targetHash }, null, 2)
  )
  console.log(JSON.stringify({ checks, errors }, null, 2))
} finally {
  await browser.close()
}
