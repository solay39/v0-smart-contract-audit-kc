// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title Solay39EnterpriseRegistry
 * @notice Enterprise on-chain audit registry with multi-auditor support
 * @dev Combines the simplicity of AuditRegistry with multi-auditor attestation.
 *      Supports publishAudit() with address[] auditors for enterprise dual review.
 *      Deploy on BSC Mainnet alongside Solay39AuditRegistry and Solay39Attestation.
 */
contract Solay39EnterpriseRegistry {

    // --- STRUCTS ---

    struct Audit {
        string    project;
        string    reportHash;
        string    commitHash;
        address[] auditors;
        uint256   timestamp;
    }

    // --- STATE ---

    mapping(bytes32 => Audit) public audits;
    bytes32[] private _auditIds;

    // --- EVENTS ---

    event AuditPublished(
        bytes32 indexed id,
        string  project
    );

    // --- WRITE ---

    /**
     * @notice Publish a new audit report on-chain with multiple auditors
     * @param project     Name of the audited project (e.g. "Chainlink")
     * @param reportHash  SHA-256 hash of the complete JSON report
     * @param commitHash  Git commit hash or contract address of the audited code
     * @param auditors    Array of auditor wallet addresses
     */
    function publishAudit(
        string memory project,
        string memory reportHash,
        string memory commitHash,
        address[] memory auditors
    ) public returns (bytes32 id) {
        id = keccak256(
            abi.encodePacked(project, reportHash, block.timestamp)
        );

        audits[id] = Audit(
            project,
            reportHash,
            commitHash,
            auditors,
            block.timestamp
        );

        _auditIds.push(id);

        emit AuditPublished(id, project);
    }

    // --- READ ---

    function verifyAudit(bytes32 id)
        external
        view
        returns (
            string memory project,
            string memory reportHash,
            string memory commitHash,
            address[] memory auditors,
            uint256 timestamp
        )
    {
        Audit storage a = audits[id];
        require(a.timestamp > 0, "Audit not found");
        return (a.project, a.reportHash, a.commitHash, a.auditors, a.timestamp);
    }

    function verifyByReportHash(string calldata reportHash)
        external
        view
        returns (bool found, bytes32 id)
    {
        bytes32 needle = keccak256(bytes(reportHash));
        for (uint256 i = 0; i < _auditIds.length; i++) {
            bytes32 aid = _auditIds[i];
            if (keccak256(bytes(audits[aid].reportHash)) == needle) {
                return (true, aid);
            }
        }
        return (false, bytes32(0));
    }

    function getAuditCount() external view returns (uint256) {
        return _auditIds.length;
    }

    function getAllAuditIds() external view returns (bytes32[] memory) {
        return _auditIds;
    }
}
