// ════════════════════════════════════════════════════════════════
// SOLAY39 — Sync Audit from Supabase to GitHub
// Fetches audit from Supabase API and saves to local ./audits folder
// Generates SHA256 hash for integrity verification
// ════════════════════════════════════════════════════════════════

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

// Fetch audit report from Supabase
async function fetchReport() {
  const url = `${SUPABASE_API}/${AUDIT_ID}`;
  console.log(`Fetching: ${url}`);
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  
  // Return HTML report if available, otherwise stringify the data
  if (data.data?.htmlReport) {
    return data.data.htmlReport;
  }
  
  throw new Error("No HTML report found in audit data");
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

async function main() {
  try {
    console.log(`\n=== SOLAY39 Audit Sync ===`);
    console.log(`Audit ID: ${AUDIT_ID}`);
    
    const html = await fetchReport();
    const hash = generateHash(html);

    // Create output directory if needed
    if (!fs.existsSync(OUTPUT_PATH)) {
      fs.mkdirSync(OUTPUT_PATH, { recursive: true });
    }

    const fileName = `${AUDIT_ID}.html`;
    const hashFile = `${AUDIT_ID}.sha256`;

    // Save files
    fs.writeFileSync(`${OUTPUT_PATH}/${fileName}`, html, "utf8");
    fs.writeFileSync(`${OUTPUT_PATH}/${hashFile}`, hash, "utf8");

    console.log(`\nReport saved: ${OUTPUT_PATH}/${fileName}`);
    console.log(`Hash saved:   ${OUTPUT_PATH}/${hashFile}`);
    console.log(`SHA256: ${hash}`);
    
    // Verify integrity
    const isValid = verifyHash(html, hash);
    console.log(`Integrity: ${isValid ? "VERIFIED" : "WARNING - hash mismatch"}`);
    
    console.log(`\n=== Sync Complete ===\n`);
    
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main();
