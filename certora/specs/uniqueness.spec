# Certora-style specification skeleton; adapt to the project's Certora DSL.
# 1. A successful registration leaves a non-zero timestamp and report hash.
# 2. A second registration with an already registered report hash reverts.
# 3. Only owner/verified auditors can register or change verification.
# 4. Successful publishes append an id and do not overwrite prior records.
#
# Pseudocode:
# rule stored_record_is_nonzero { assert audits[id].timestamp != 0; }
# rule duplicate_report_rejected { assume first succeeds; assert second reverts; }
# rule privileged_calls_are_authorized { assert caller == owner || verifiedAuditors[caller]; }
