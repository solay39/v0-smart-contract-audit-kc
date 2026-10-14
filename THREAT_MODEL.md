# Solay39 Smart Contract Threat Model

## Scope
Contracts in scope:
- `contracts/Solay39EnterpriseRegistry.sol`
- `contracts/Solay39AuditRegistry.sol`
- `contracts/AuditRegistry.sol`
- `contracts/Solay39Attestation.sol`

The review covers Solidity contracts, deployment configuration, governance roles, and the CI evidence attached to the audited commit. Frontend, RPC providers, explorers, and off-chain indexers are out of scope except where they influence trust assumptions.

## Assets
- Integrity of published audit records and attestations.
- Correctness of verifier, invalidation, and timelock administration.
- Availability of registry read paths as record volume grows.
- Deployment bytecode, constructor arguments, and governance configuration.

## Trust assumptions
- The configured owner and timelock are controlled by the declared governance process.
- A multisig protects privileged actions and its signers follow key-rotation and incident-response policy.
- The deployment operator supplies the intended constructor arguments and verifies bytecode.
- External RPC and explorer data used for operations is authenticated and independently checked.

## Threat actors
1. Unauthenticated caller attempting to publish, register, invalidate, or reconfigure records.
2. Compromised owner or deployer key attempting privileged changes.
3. Malicious or compromised integration submitting malformed or duplicate data.
4. Griefer attempting to increase storage or gas costs and make verification impractical.
5. Supply-chain attacker modifying dependencies, compiler settings, or deployment artifacts.

## Critical security properties
- State-changing privileged functions reject unauthorized callers.
- Audit identifiers and report hashes resolve deterministically, including duplicate-hash behavior.
- No external call can violate checks-effects-interactions or silently ignore a failed call.
- Governance addresses and timelock configuration are verified on-chain before production use.
- A clean build from a pinned commit reproduces the submitted bytecode and metadata.

## Review scenarios
| Scenario | Expected control | Evidence |
|---|---|---|
| Unauthorized publish/register/invalidate | owner/role/timelock check reverts | Forge negative tests |
| Duplicate report hash | documented deterministic first-match behavior | unit test and event history |
| Large registry | indexed lookup; no avoidable full-registry scan | gas/scaling test |
| Governance compromise | multisig threshold and timelock delay limit unilateral action | `inspect_onchain.mjs` output and policy |
| Build substitution | pinned compiler/config and matching bytecode | reproducible-build report |

## Residual risks to resolve before production
- Record network, deployed addresses, deployment transactions, and owner/timelock proof are not embedded in this repository.
- Coverage and scaling thresholds must be reviewed against the final deployed commit.
- Any automated warning not represented in the final reports must be classified and accepted in writing.
- External audit remains required; this document is not a certification.

## Reviewer sign-off
- Reviewed commit: `________________`
- Network(s): `________________`
- Reviewer/date: `________________`
- Open findings and accepted risks: `________________`
- Approval for external audit submission: `YES / NO`

See `AUDIT_EXTERNAL_SCOPE.md` and `scripts/verify_reproducible_build.sh` for the submission workflow.
