// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/Solay39EnterpriseRegistry.sol";

contract EchidnaHarness {
    Solay39EnterpriseRegistry public immutable registry;

    constructor() {
        registry = new Solay39EnterpriseRegistry();
    }

    function publish(bytes calldata project, bytes calldata reportHash, bytes calldata commitHash, address auditor) external {
        address[] memory auditors = new address[](1);
        auditors[0] = auditor == address(0) ? address(this) : auditor;
        registry.publishAudit(string(project), string(reportHash), string(commitHash), auditors);
    }

    function echidna_all_ids_exist() external view returns (bool) {
        bytes32[] memory ids = registry.getAllAuditIds();
        for (uint256 i = 0; i < ids.length; i++) {
            try registry.verifyAudit(ids[i]) returns (string memory, string memory, string memory, address[] memory, uint256 timestamp) {
                if (timestamp == 0) return false;
            } catch {
                return false;
            }
        }
        return true;
    }

    function echidna_count_matches_ids() external view returns (bool) {
        return registry.getAuditCount() == registry.getAllAuditIds().length;
    }
}
