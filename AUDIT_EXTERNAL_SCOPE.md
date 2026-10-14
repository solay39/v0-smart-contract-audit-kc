# External Smart Contract Audit Scope

## Objective
Independent review of the Solidity registries and their deployment configuration before production use. Automated CI is evidence, not a certification.

## In-scope contracts
- `contracts/Solay39EnterpriseRegistry.sol`
- `contracts/Solay39AuditRegistry.sol`
- `contracts/AuditRegistry.sol`
- `contracts/Solay39Attestation.sol`

## Security objectives
1. Only authorized governance can publish, register, invalidate, or change configuration.
2. Audit records and attestations cannot be forged, overwritten, or ambiguously resolved.
3. Read paths remain usable as the registry grows and cannot create an avoidable gas denial of service.
4. Ownership and timelock administration are correctly initialized and transferred.
5. Build artifacts are reproducible and match verified deployment bytecode.

## Manual review questions
- Identify every state-changing function and its caller authorization.
- Confirm owner, timelock, verifier, and attestation roles on-chain.
- Confirm owner/timelock addresses are governed contracts, not individual EOAs, where policy requires it.
- Check zero-address, duplicate-record, empty-input, and replay behavior.
- Review storage growth, loops, event completeness, and return-value handling.
- Confirm compiler version, optimizer settings, dependencies, and deployment constructor arguments.

## Evidence to provide
- Commit SHA and `foundry.toml`.
- Threat model and trust assumptions from `THREAT_MODEL.md`.
- Reproducible-build output from `scripts/verify_reproducible_build.sh`, including compiler/config and artifact hash manifest.
- Submission archive created by `scripts/package_artifacts.sh` after the final CI run.
- Forge test, coverage, Slither, Mythril, and Echidna artifacts.
- Verified explorer links and deployment transactions for every network.
- `owner()`, `timelock()`, and role-member call results, plus `eth_getCode` for administrators.
- Multisig threshold/signers and timelock delay/configuration.
- Known limitations, accepted risks, and unresolved findings.

## Acceptance gates
- No unresolved Critical or High findings.
- Every automated warning is resolved or documented with rationale and a regression test.
- Critical functions have meaningful success and failure-path coverage.
- Deployment bytecode is reproducible and verified.
- Governance evidence is attached and independently reviewed.

## Review status
- Automated CI: record the passing run URL and commit here.
- Manual review: record reviewer, date, scope, findings, and residual risk.
- External audit: pending until an independent auditor accepts the scope.

## Important disclaimer
Passing CI and this checklist do not mean CertiK-certified or audit-free. They establish audit readiness only; an independent security audit remains required.
