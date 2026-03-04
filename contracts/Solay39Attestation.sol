// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title Solay39Attestation
 * @notice Immutable on-chain attestation for multi-auditor security reports
 * @dev Supports multiple auditor addresses per attestation (Enterprise dual review)
 *      Deploy on BSC Mainnet alongside Solay39AuditRegistry
 */
contract Solay39Attestation {

    // --- STRUCTS ---

    struct Attestation {
        string    project;
        string    reportHash;    // SHA-256 of the full JSON report
        string    commitHash;    // Contract address or git commit
        address[] auditors;      // All auditor wallets that signed
        uint256   timestamp;
        bool      dualReview;    // true if >= 2 independent auditors
    }

    // --- STATE ---

    address public immutable owner;
    uint256 public totalAttestations;

    mapping(bytes32 => Attestation) public attestations;
    bytes32[] private _attestationIds;

    // --- EVENTS ---

    event AuditAttested(
        bytes32 indexed id,
        string  project,
        string  reportHash,
        address[] auditors,
        bool    dualReview,
        uint256 timestamp
    );

    // --- ERRORS ---

    error OnlyOwner();
    error AttestationExists(bytes32 id);
    error EmptyField(string field);
    error NoAuditors();

    // --- CONSTRUCTOR ---

    constructor() {
        owner = msg.sender;
    }

    // --- MODIFIERS ---

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // --- WRITE ---

    /**
     * @notice Attest a multi-auditor security report on-chain
     * @param project     Name of the audited project
     * @param reportHash  SHA-256 hash of the complete JSON report
     * @param commitHash  Contract address or source commit hash
     * @param auditors    Array of auditor wallet addresses (>= 1, >= 2 for dual review)
     */
    function attestAudit(
        string calldata project,
        string calldata reportHash,
        string calldata commitHash,
        address[] calldata auditors
    ) external onlyOwner returns (bytes32 id) {

        if (bytes(project).length == 0)    revert EmptyField("project");
        if (bytes(reportHash).length == 0) revert EmptyField("reportHash");
        if (auditors.length == 0)          revert NoAuditors();

        id = keccak256(
            abi.encodePacked(project, reportHash, block.timestamp)
        );

        if (attestations[id].auditors.length > 0) revert AttestationExists(id);

        bool dual = _countUniqueAddresses(auditors) >= 2;

        attestations[id] = Attestation({
            project:    project,
            reportHash: reportHash,
            commitHash: commitHash,
            auditors:   auditors,
            timestamp:  block.timestamp,
            dualReview: dual
        });

        _attestationIds.push(id);
        totalAttestations++;

        emit AuditAttested(id, project, reportHash, auditors, dual, block.timestamp);
    }

    // --- READ ---

    function verifyAttestation(bytes32 id)
        external
        view
        returns (
            string memory project,
            string memory reportHash,
            string memory commitHash,
            address[] memory auditors,
            uint256 timestamp,
            bool dualReview
        )
    {
        Attestation storage a = attestations[id];
        require(a.timestamp > 0, "Attestation not found");
        return (a.project, a.reportHash, a.commitHash, a.auditors, a.timestamp, a.dualReview);
    }

    function verifyByReportHash(string calldata reportHash)
        external
        view
        returns (bool found, bytes32 id)
    {
        bytes32 needle = keccak256(bytes(reportHash));
        for (uint256 i = 0; i < _attestationIds.length; i++) {
            bytes32 aid = _attestationIds[i];
            if (keccak256(bytes(attestations[aid].reportHash)) == needle) {
                return (true, aid);
            }
        }
        return (false, bytes32(0));
    }

    function getAllAttestationIds() external view returns (bytes32[] memory) {
        return _attestationIds;
    }

    // --- INTERNAL ---

    function _countUniqueAddresses(address[] calldata addrs) internal pure returns (uint256) {
        if (addrs.length <= 1) return addrs.length;
        // Simple O(n^2) for small arrays (typically 2-5 auditors)
        uint256 unique = 1;
        for (uint256 i = 1; i < addrs.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < i; j++) {
                if (addrs[i] == addrs[j]) { found = true; break; }
            }
            if (!found) unique++;
        }
        return unique;
    }
}
