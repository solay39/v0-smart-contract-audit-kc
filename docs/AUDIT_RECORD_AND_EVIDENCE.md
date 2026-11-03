# Audit record, evidence bundle, and score methodology

This workflow creates a versioned audit record and packages its source revision and evidence files with SHA-256 digests. It is not a certification service. A digest proves that bytes have not changed relative to that digest; it does not prove that the finding is correct, the reviewer is qualified, or a signature is authentic.

## Record format

`schemas/audit-record.schema.json` is the JSON Schema Draft 2020-12 contract. A record captures:

- stable audit ID, project/network and review scope;
- full 40-character Git commit SHA and repository identifier for the exact audited source;
- status, methodology version, timestamps, manual-review state and named reviewers;
- findings with stable IDs, severity, status, file/line location and references to evidence artifacts;
- evidence artifacts with repository-relative paths and media types.

Keep records immutable after publication. A correction or new source revision should create a new record/version and preserve the prior bundle. Never put secrets, private keys, credentials or customer data in a public record or bundle.

## Validate and score

Validate a record and create a deterministic scorecard only after a full manual review:

```bash
node scripts/score-audit-record.mjs reports/audit-record.json /tmp/audit-scorecard.json
```

Method `SOLAY39-SEVERITY-PENALTY-1.0` starts at 100 and subtracts per unresolved finding: CRITICAL 25, HIGH 10, MEDIUM 3, LOW 1, INFO 0; the result is clamped to 0–100. `OPEN` and `ACCEPTED_RISK` findings incur deductions; `MITIGATED` and `FALSE_POSITIVE` remain visible in the report but do not. The scorecard lists every deduction by finding ID and includes the exact report SHA-256 and source commit. It is a transparent internal severity index—not a probability of safety, a substitute for expert judgment, or comparable to another provider's score. It must not be generated for draft/automated-only records.

## Build the evidence bundle

The record's `evidence.artifacts[].path` values must be repository-relative files. The builder rejects path traversal, symlinks resolving outside the repository, missing/non-file artifacts, invalid records, and commits that do not resolve to the exact full Git SHA in that repository.

```bash
node scripts/build-audit-evidence-bundle.mjs \
  --record reports/audit-record.json \
  --repo-root . \
  --out-dir /tmp/audit-evidence-bundle
```

The output directory contains the original `audit-record.json`, copied `artifacts/`, an optional scorecard (only after full manual review), `manifest.json`, and `manifest.sha256`. The manifest binds the report and every copied artifact to SHA-256, records the source commit, and has a detached checksum. Preserve or sign the manifest checksum using a separately controlled signing process before calling the bundle authenticated. This CLI does not create or verify digital signatures and does not upload or persist the bundle.

## Publication gates and limitations

- `FULL` review requires a named reviewer and non-empty scope. `MANUAL_REVIEWED` and `PUBLISHED` require `FULL`; `PUBLISHED` also requires a completion timestamp.
- Findings must reference artifact IDs that exist in the record. Keep proof artifacts safe to disclose and useful to reproduce the finding.
- Bundle creation verifies the commit exists in the local repository and hashes the report/artifacts as bytes. It does not prove the audit was actually performed against that commit; that assurance requires a controlled review workflow and independent checks.
- Production publication still needs durable storage, access controls, reviewer identity verification, cryptographic signature verification, version management and a reviewed operational methodology. Those capabilities are not implied by this schema or CLI.
