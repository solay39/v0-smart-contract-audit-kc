# Certora specification boilerplate

These properties are a review starting point and must be translated to the exact Certora DSL and harness used by the project.

- Uniqueness: repeated successful publishes never overwrite an existing record.
- Immutability: stored timestamp and report hash remain non-zero after registration.
- Access control: only the owner or verified auditors call privileged registry methods.

Run formal verification only after mapping storage fields and method signatures to the deployed contract version.
