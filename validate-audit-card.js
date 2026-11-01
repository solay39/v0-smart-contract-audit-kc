#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")

function number(value) { const result = Number(value ?? 0); return Number.isFinite(result) ? result : 0 }
function hasEvidence(project) {
  return Boolean(project?.reportHash || project?.reportIntegrity?.sha256 || project?.auditManifest?.hash || project?.evidence?.ci_artifacts?.length || project?.reviewer_names?.length || project?.reviewerNames?.length || project?.engagement?.reviewTeam?.reviewStatus || project?.reviewRecord?.consensusReached || project?.findings?.length)
}
function validateCard(project) {
  const errors = []; const status = String(project?.status ?? project?.auditStatus ?? "DEMO").toUpperCase(); const score = number(project?.score ?? project?.securityScore); const criticals = number(project?.criticals); const highs = number(project?.highs); const mediums = number(project?.mediums); const audited = status === "AUDITED" || project?.isAudited === true
  if (audited && !hasEvidence(project)) errors.push("AUDITED requires evidence: reportHash, reviewer names, CI artifacts, signed review, or findings")
  if (audited && score === 0 && criticals === 0 && highs === 0 && mediums === 0) errors.push("AUDITED projects cannot have score=0 and no findings")
  if (score < 0 || score > 100) errors.push("score must be between 0 and 100")
  if ([criticals, highs, mediums].some((value) => value < 0)) errors.push("finding counters cannot be negative")
  return errors
}
const file = process.argv[2]
if (!file) { console.error("Usage: node validate-audit-card.js <audit-card.json>"); process.exit(1) }
const fullPath = path.resolve(file)
if (!fs.existsSync(fullPath)) { console.error(`File not found: ${fullPath}`); process.exit(1) }
try { const errors = validateCard(JSON.parse(fs.readFileSync(fullPath, "utf8"))); if (errors.length) { console.error("Audit card validation failed:"); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1) }; console.log("Audit card validation passed.") } catch (error) { console.error(`Invalid JSON: ${error.message}`); process.exit(1) }
