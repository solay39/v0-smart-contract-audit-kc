// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SOLAY39 â€” Sync Audit from Supabase to GitHub (FIXED)
// Fetches the stored HTML report (full 38 pages) from the API
// and saves it to ./audits/ with the correct SOLAY39 naming convention
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import fs from "fs";
import crypto from "crypto";

const SUPABASE_API = process.env.SUPABASE_API_URL || "https://www.solay39.eu/api/audit";
const OUTPUT_PATH = "./audits";

// Get audit ID from environment or command line
const AUDIT_ID = process.env.AUDIT_ID || process.argv[2];

if (!AUDIT_ID) {
  console.error("Usage: AUDIT_ID=my-audit-id node sync-audit.mjs");
  console.error("   or: node sync-audit.mjs my-audit-id");
  process.exit(1);
}

// Fetch the full audit JSON from the platform API
async function fetchAuditData() {
  const url = `${SUPABASE_API}/${AUDIT_ID}`;
  console.log(`Fetching: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}): ${res.statusText}`);
  }

  return await res.json();
}

// Generate SHA256 hash for integrity verification
function generateHash(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// Verify hash matches meta tag in HTML
function verifyHash(html, expectedHash) {
  const match = html.match(/<meta name="audit-hash" content="([a-f0-9]+)">/i);
  if (!match) {
    console.warn("Warning: No audit-hash meta tag found in HTML");
    return false;
  }
  const embeddedHash = match[1];
  if (embeddedHash !== expectedHash) {
    console.warn(`Warning: Hash mismatch!`);
    console.warn(`  Embedded: ${embeddedHash}`);
    console.warn(`  Computed: ${expectedHash}`);
    return false;
  }
  return true;
}

// Build the SOLAY39 filename from audit metadata
// Matches the naming convention used by publish/republish APIs:
// SOLAY39-{ProjectName}-Audit-{date}.html
function buildFileName(auditData) {
  // The API returns the full portfolioData object directly
  const name =
    auditData?.name ||
    auditData?.data?.name ||
    "Unknown";

  const date =
    auditData?.date ||
    auditData?.data?.date ||
    auditData?.data?.engagement?.auditDate ||
    new Date().toISOString().slice(0, 10);

  const safeName = name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-]/g, "");
  return `SOLAY39-${safeName}-Audit-${date}.html`;
}

async function main() {
  try {
    console.log(`\n=== SOLAY39 Audit Sync ===`);
    console.log(`Audit ID: ${AUDIT_ID}`);

    const auditData = await fetchAuditData();

    // The platform API returns different shapes depending on whether
    // the audit is a static project or a Supabase/Blob audit.
    // The htmlReport lives at:
    //   auditData.htmlReport           (direct field â€” PortfolioProject)
    //   auditData.data.htmlReport      (nested â€” Supabase audits table row)

    let html =
      auditData?.htmlReport ||
      auditData?.data?.htmlReport ||
      null;

    if (!html || html.length < 1000) {
      throw new Error(
        `No valid HTML report found in API response for audit "${AUDIT_ID}". ` +
        `Got ${html?.length || 0} bytes. ` +
        `Make sure the audit has been published first via the platform.`
      );
    }

    const htmlSizeKB = Math.round(html.length / 1024);
    console.log(`HTML report found: ${htmlSizeKB}KB`);

    const hash = generateHash(html);

    // Build filename using SOLAY39 naming convention
    const fileName = buildFileName(auditData?.data || auditData);
    const hashFile = fileName.replace(".html", ".sha256");

    console.log(`File name: ${fileName}`);

    // Create output directory if needed
    if (!fs.existsSync(OUTPUT_PATH)) {
      fs.mkdirSync(OUTPUT_PATH, { recursive: true });
    }

    // Save files
    fs.writeFileSync(`${OUTPUT_PATH}/${fileName}`, html, "utf8");
    fs.writeFileSync(`${OUTPUT_PATH}/${hashFile}`, hash, "utf8");

    console.log(`\nReport saved: ${OUTPUT_PATH}/${fileName}`);
    console.log(`Hash saved:   ${OUTPUT_PATH}/${hashFile}`);
    console.log(`SHA256: ${hash}`);

    // Verify integrity
    const isValid = verifyHash(html, hash);
    console.log(`Integrity: ${isValid ? "VERIFIED âœ“" : "WARNING â€” hash mismatch"}`);

    console.log(`\n=== Sync Complete ===\n`);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main();