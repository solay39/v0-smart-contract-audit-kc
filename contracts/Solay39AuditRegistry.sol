// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title Solay39AuditRegistry
 * @notice Immutable on-chain registry for Solay39 security audit reports
 * @dev Deploy on BSC Mainnet -- minimal gas footprint
 */
contract Solay39AuditRegistry {

    // --- STRUCTS ---

    struct AuditRecord {
        string  projectName;
        string  reportHash;    // SHA-256 del report JSON
        string  commitHash;    // Contract address o commit hash
        address auditor;       // Wallet del lead auditor
        uint256 timestamp;     // Block timestamp al momento della registrazione
        bool    exists;        // Sentinel per distinguere record vuoti
    }

    // --- STATE ---

    address public immutable owner;
    uint256 public totalAudits;

    mapping(bytes32 => AuditRecord) private _audits;
    bytes32[] private _auditIds;

    // --- EVENTS ---

    event AuditRegistered(
        bytes32 indexed auditId,
        string  indexed projectName,
        string  reportHash,
        address auditor,
        uint256 timestamp
    );

    // --- ERRORS ---

    error OnlyOwner();
    error AuditAlreadyExists(bytes32 auditId);
    error AuditNotFound(bytes32 auditId);
    error EmptyField(string field);

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
     * @notice Registra un nuovo audit report on-chain
     * @param projectName Nome del progetto auditato
     * @param reportHash  SHA-256 hash del report JSON completo
     * @param commitHash  Indirizzo contratto o commit hash del codice auditato
     */
    function registerAudit(
        string calldata projectName,
        string calldata reportHash,
        string calldata commitHash
    ) external onlyOwner returns (bytes32 auditId) {

        if (bytes(projectName).length == 0) revert EmptyField("projectName");
        if (bytes(reportHash).length == 0)  revert EmptyField("reportHash");

        auditId = keccak256(
            abi.encodePacked(projectName, reportHash, block.timestamp, msg.sender)
        );

        if (_audits[auditId].exists) revert AuditAlreadyExists(auditId);

        _audits[auditId] = AuditRecord({
            projectName: projectName,
            reportHash:  reportHash,
            commitHash:  commitHash,
            auditor:     msg.sender,
            timestamp:   block.timestamp,
            exists:      true
        });

        _auditIds.push(auditId);
        totalAudits++;

        emit AuditRegistered(auditId, projectName, reportHash, msg.sender, block.timestamp);
    }

    // --- READ ---

    function verifyAudit(bytes32 auditId)
        external
        view
        returns (AuditRecord memory)
    {
        if (!_audits[auditId].exists) revert AuditNotFound(auditId);
        return _audits[auditId];
    }

    function verifyByHash(string calldata reportHash)
        external
        view
        returns (bool found, bytes32 auditId, AuditRecord memory record)
    {
        for (uint256 i = 0; i < _auditIds.length; i++) {
            bytes32 id = _auditIds[i];
            if (keccak256(bytes(_audits[id].reportHash)) == keccak256(bytes(reportHash))) {
                return (true, id, _audits[id]);
            }
        }
        return (false, bytes32(0), AuditRecord("", "", "", address(0), 0, false));
    }

    function getAllAuditIds() external view returns (bytes32[] memory) {
        return _auditIds;
    }
}
