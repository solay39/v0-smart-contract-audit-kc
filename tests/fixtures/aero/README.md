# Pinned AERO source verification profile

This fixture is the exact public source snapshot acquired during the earlier AERO review, not a newly submitted audit. Its original `GPL-3.0-or-later` SPDX header and upstream source comments are preserved in `Aero.sol`.

The SHA-256 is `52e494f011e5966f6d1f67045f89ca60843a48a00082c0032dd0ae77da3fe682`. This profile identifies source bytes only; it does not independently identify a network, deployed address, constructor state or the wider Aerodrome protocol.

## Executed checks

- **Minting and authority:** authorized supply/balance changes, unauthorized mint rejection, unauthorized minter rotation rejection and transfer of minting authority.
- **Transfers:** sender/recipient accounting, total-supply conservation, overdraft rejection and atomic rollback on rejected operations.
- **Allowances:** finite allowance consumption, maximum allowance preservation and rejection of spending above allowance.
- **Zero addresses:** rejection of mint, transfer and approval operations targeting the zero address.
- **Stateful model:** four tracked actors, bounded minting, transfers, approval/spending and unauthorized mint attempts. Two invariant predicates check balances/supply against independent ghost accounting and preservation of the designated minter.
- **Negative controls:** independent intentionally broken copies remove mint authorization, transfer credit, allowance consumption or supply increments. Each must compile and produce the expected assertion failure with a recorded replayable fuzz counterexample. Compiler errors, timeouts, unrelated reverts and a passing mutant are not successful detection.

There are eight fuzz properties with 256 observed runs each, two ordinary tests and two invariant predicates in one grouped campaign. The invariant campaign requires 128 runs at depth 64 and 8,192 observed handler calls with no reverts or discards; all four permitted handler methods must actually execute.

The reader checks measured Forge metadata, not configured counts. Grouped invariants share the same campaign, so its 8,192 calls are counted once, not multiplied by the number of predicates.

## Reproduction on Linux amd64

The workflow downloads the archive identified by the [Foundry v1.9.0 release metadata](https://api.github.com/repos/foundry-rs/foundry/releases/tags/v1.9.0) and validates its SHA-256 before extracting `forge`. It also validates the Solidity binary against the digest in the [official Solidity compiler index](https://binaries.soliditylang.org/linux-amd64/list.json).

| Input | Pinned value |
|---|---|
| Foundry release archive SHA-256 | `8d17599b42e3139f1a9c171be3798c4ed8e743ae17b84cc3435e57bf2a51ae99` ([release metadata](https://api.github.com/repos/foundry-rs/foundry/releases/tags/v1.9.0)) |
| Extracted `forge` SHA-256 | `26fc0c5ef0574f543acf496674160fe9a2175922ae44fd32f46ee2d09fdff4bc` |
| Foundry commit | `6056c5845d34205a83cf7108042adb137325c9df` |
| Linux amd64 Solidity 0.8.19 SHA-256 | `7a5c1d3dc9a8eba62bb2ec37192c9178ae5fe8a54a56e5573fd3c9c17cd9eb48` ([compiler index](https://binaries.soliditylang.org/linux-amd64/list.json)) |
| Compiler settings | Solidity 0.8.19; Paris EVM; optimizer enabled, 200 runs; no IR |
| Fuzz seed | `0x39` |
| Host capabilities | FFI disabled; no filesystem permissions; no fork or RPC |

After installing the pinned tools:

```sh
python3 -m unittest discover -s tests -p test_source_verification.py -v
python3 scripts/verify-aero-source.py \
  --forge /absolute/path/to/forge \
  --solc /absolute/path/to/solc \
  --out .local/aero-verification
python3 scripts/verify-aero-source.py \
  --verify-bundle .local/aero-verification
```

The output directory must not already exist. Every mutant starts from the original snapshot, and the original checked-in fixture is never modified.

The runner performs two clean builds in the same isolated temporary workspace after deleting cache and outputs. It captures both Standard JSON compiler inputs and AERO artifacts, verifies exact source and harness contents, validates the target/compiler/settings and compares both creation and runtime bytecode hashes. Dynamic test linking is explicitly disabled so the captured harness really is the compiler input.

Raw compiler results, Forge JSON, stderr, exit statuses, source/configuration/harness/verifier bytes, tool hashes, counterexamples and file hashes are retained. The offline bundle reader rechecks the inventory, hashes, measured results and controls against this checkout's trusted profile; validate older bundles using their matching repository revision.

## Integration and boundaries

`aero-source-verification.yml` runs on relevant pull requests, main-branch changes and manual dispatch. The existing static-analysis dispatcher can explicitly select `aero-erc20-v2`, forwarding the submitted source to the reusable workflow; a different source digest fails closed.

The default app runner still uses `benchmark=none`. This PR does not automatically label arbitrary uploaded contracts as having passed these source-specific tests, import these results into public audit records, sign a founder approval or publish an audit.

Two clean builds on one host demonstrate local repeatability, not cross-machine reproducibility or equality with on-chain deployment bytecode. Sampled ERC-20 properties are not complete protocol coverage; permit signatures, economic attacks, deployment state, integrations and production configuration are outside this profile.

Content hashes detect tampering relative to a manifest; they are not cryptographic proof of execution origin, an attestation or an independent review. Forge results must also be traced to the trusted CI job and reviewed by the founder before being used in an audit conclusion.

The Python tests use explicitly synthetic parser fixtures. Their success is not Solidity execution evidence; the separate pinned-tool workflow must execute the real source and retain its raw artifacts.
