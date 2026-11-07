// A read-only public snapshot. No secrets, private catalog or server deployment.
import { chromium } from "playwright"
import { mkdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { normalizeDirectory } from "../lib/skynet-directory"
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve("tsx/cli"))("esbuild")
const out = ".local/skynet-preview"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "chromium", headless: true })
try {
  const context = await browser.newContext()
  const response = await context.request.get(
    "https://www.solay39.eu/api/audits",
    { timeout: 120_000 }
  )
  if (!response.ok())
    throw new Error(`Public catalog unavailable (${response.status()})`)
  const data = await response.json()
  const snapshot = {
    projects: normalizeDirectory(data.audits),
    observedAt: new Date().toISOString(),
  }
  if (!snapshot.projects.length)
    throw new Error("Refusing to build a misleading empty preview")
  await writeFile(".local/skynet-snapshot.json", JSON.stringify(snapshot))
  await writeFile(
    ".local/skynet-preview-entry.tsx",
    `
import React from "react";
import { createRoot } from "react-dom/client";
import { SkynetDiscovery } from "../components/skynet-discovery";
import snapshot from "./skynet-snapshot.json";
createRoot(document.getElementById("root")!).render(<SkynetDiscovery initialSnapshot={snapshot as any} preview />);
`
  )
  await build({
    entryPoints: [".local/skynet-preview-entry.tsx"],
    bundle: true,
    minify: true,
    outdir: out,
    entryNames: "app",
    define: { "process.env.NODE_ENV": '"production"' },
    jsx: "automatic",
    target: "es2022",
  })
  await writeFile(
    `${out}/index.html`,
    `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Solay39 Skynet: anteprima PR</title><link rel="stylesheet" href="./app.css"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>`
  )
  console.log(
    JSON.stringify({
      publicSource: "https://www.solay39.eu/api/audits",
      projects: snapshot.projects.length,
      observedAt: snapshot.observedAt,
      output: out,
      live: false,
    })
  )
} finally {
  await browser.close()
}
