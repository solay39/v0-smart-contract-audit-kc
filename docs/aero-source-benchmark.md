# AERO source-pinned authorization benchmark

This is a reproducible check on one captured token-source snapshot, not a final audit, certification, fork of Base or assessment of the full Aerodrome protocol. Only the founder can validate findings and approve a report.

## Source identity

- Contract declared by explorer: Base, `0x940181a94a35a4569e4529a3cdfb74e38fd98631`.
- Source location: https://basescan.org/address/0x940181a94a35a4569e4529a3cdfb74e38fd98631#code
- Required SHA-256: `52e494f011e5966f6d1f67045f89ca60843a48a00082c0032dd0ae77da3fe682`.
- Snapshot: 62,962 UTF-8 bytes, 62,955 JavaScript characters, 1,762 logical lines.
- Preserve its original GPL-3.0-or-later notices. The exact bytes, not a source with normalized whitespace, must match the digest.

The workflow rejects any other source before installing/executing the benchmark. This permits a trusted harness without executing arbitrary model-generated tests using workflow credentials.

## Run

Use a reviewed revision containing this workflow and a locally captured source whose digest matches:

```sh
sha256sum Aero.sol
JOB_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"
gh workflow run static-analysis-dispatch.yml --ref REVIEWED_BRANCH_OR_TAG \
  -f job_id="$JOB_ID" -f contract_name=Aero \
  -f benchmark=aero-authorization-v1 \
  -f source_gz_b64="$(gzip -cn Aero.sol | base64 -w0)"
```

The default `benchmark=none` preserves the existing compile-only scanner behavior. Opting into the benchmark adds a separate job and artifact; it does not silently turn the normal scanner evidence into fuzzing/invariant evidence.

## Assertions and observations

The versioned harness is `tests/security/AeroSourceAuthorization.t.sol`. The workflow places it at `benchmark/test/` and the pinned source at `benchmark/src/Aero.sol`.

- Unauthorized mint reverts with the expected `NotMinter` selector without changing supply.
- Authorized mint changes the recipient balance and total supply.
- Unauthorized setMinter reverts.
- After delegation, only the new minter can mint.
- A fuzz property samples unauthorized callers and amounts.
- Observation: a zero minter is accepted and the former minter is blocked.
- Observation: a large authorized mint sample succeeds.
- Observation: the newly authorized minter can delegate again.

Observation success means the behavior occurred, not that the behavior is secure. A large sample is not a theorem of unlimited supply. A configured fuzz count is not a measured count; inspect the raw Forge kind metadata.

The trusted TOML specifies solc 0.8.19, Paris, optimizer 200, no FFI and a deterministic fuzz seed. Those are test settings, not independently verified deployment settings.

## Evidence and limitations

The finalizer checks source identity, the complete expected test-name set, each status, valid Forge JSON and exit zero. It hashes source, harness, config and outputs, and records repository/run/attempt/revision. Malformed, partial, empty, failed and source-mismatched results cannot pass the finalizer.

The artifact `aero-source-benchmark-<job-id>-attempt-<attempt>` is separate from the canonical scanner adapter. It must not be substituted for a verified `ciAnalysis` manifest. Artifact retention is 30 days; a final report needs durable controlled archival.

Reference executions:

- Full-source static analysis: https://github.com/solay39/v0-smart-contract-audit-kc/actions/runs/42336911298
- Trusted authorization benchmark: https://github.com/solay39/v0-smart-contract-audit-kc/actions/runs/42337768199

No claims are made of deployed-bytecode correspondence, a live fork, full-protocol coverage, complete permit coverage, exhaustive fuzzing, formal proof, remediation retest or founder approval.

## Report behavior

The engine's bounded full-source analysis builds a lexical inventory, not an AST or compiled reachability proof. Function-local entry checks can contradict an unrestricted-mint claim but do not automatically establish complete authorization safety. Unresolved modifiers remain unresolved.

The optional report matrix stores declared evidence categories only. Source observations never become an inferred successful test, unsupported status strings become `NOT_RUN`, and a passing observation remains distinct from a security recommendation. The classic report styling, token logo and preliminary-only approval boundary are preserved.
