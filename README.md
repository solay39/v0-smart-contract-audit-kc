# Solay39 Smart Contract Audit

Solay39 is a Next.js application for evidence-backed smart-contract security analysis. It orchestrates static analysis, symbolic execution, Foundry compilation/testing, on-chain checks, and report generation while keeping automated evidence separate from human sign-off.

## Current scope

The current focus is **AI-assisted Solidity audits with executable proof-of-concept support**. The product is not a CertiK replacement and does not claim a human audit, certification, formal verification, fuzzing, or production readiness unless a verifiable artifact and reviewer sign-off are attached.

## Architecture

- `app/` and `components/`: web application and audit workflow
- `core/`: analysis, finding, severity, PoC, and review engines
- `security-backend/`: Docker service for Slither, Mythril, Foundry, and Echidna
- `formal-verify-backend/`: Coq/K verification service; verification is only reported when the backend returns a real proof artifact
- `.github/workflows/`: reproducible CI analysis and evidence manifest
- `scripts/benchmark-security.mjs`: benchmark runner for labelled vulnerable contracts

## Development

```bash
npm install
npm run dev
npm test
npm run lint
```

`npm test` is currently a type-check gate. It does not claim protocol fuzzing or a human review.

## Security backend

```bash
cd security-backend
npm install
npm start
```

The benchmark runner sends Solidity fixtures to the backend and records raw responses, tool versions, source hashes, and expected-vs-detected labels. Set `SECURITY_API_URL` and `SECURITY_API_KEY` before running it.

## Evidence policy

Published reports are evidence-only. Automated scans are labelled `AUTOMATED_SCAN_WITH_PENDING_MANUAL_REVIEW` until CI artifacts are persisted and a named reviewer signs the report. Unsupported scores, auditor counts, engineering hours, and verification claims must not be published.

See `THREAT_MODEL.md`, `AUDIT_EXTERNAL_SCOPE.md`, and `scripts/benchmark-security.mjs` for scope and reproducibility details.
