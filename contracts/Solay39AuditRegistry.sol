// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      SOLAY39 AUDIT REGISTRY                               ║
 * ║                   On-Chain Security Attestation                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Owner: 0x2A9386C3636c9b520687BC8F11190abaf8bf98Af                        ║
 * ║  Chains: BSC Mainnet, Arbitrum One                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * DEPLOYMENT via Remix IDE:
 * 1. https://remix.ethereum.org
 * 2. New file -> Solay39AuditRegistry.sol
 * 3. Compiler -> 0.8.20
 * 4. Deploy -> Injected Provider (MetaMask)
 * 5. Select BSC or Arbitrum network
 * 6. Deploy and save address
 */

contract Solay39AuditRegistry {

    // ═══════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════

    struct AuditRecord {
        string  projectName;      // Nome progetto auditato
        string  reportHash;       // SHA-256 del report JSON
        string  codeReference;    // Contract address o commit hash
        string  ipfsCid;          // IPFS CID del report completo
        uint8   score;            // Security score 0-100
        address auditor;          // Wallet del lead auditor
        uint256 timestamp;        // Block timestamp
        bool    valid;            // Puo' essere invalidato
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════

    address public immutable owner;
    uint256 public totalAudits;

    mapping(bytes32 => AuditRecord) private _audits;
    mapping(string => bytes32) private _hashToId;
    bytes32[] private _auditIds;

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════

    event AuditRegistered(
        bytes32 indexed auditId,
        string  projectName,
        string  reportHash,
        string  ipfsCid,
        uint8   score,
        address auditor,
        uint256 timestamp
    );

    event AuditInvalidated(bytes32 indexed auditId, string reason);

    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════

    error OnlyOwner();
    error AuditAlreadyExists();
    error AuditNotFound();
    error HashAlreadyRegistered();
    error InvalidScore();
    error EmptyField();

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    // WRITE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Registra un nuovo audit on-chain
     * @param projectName Nome del progetto
     * @param reportHash SHA-256 hash del report JSON
     * @param codeReference Contract address o commit hash
     * @param ipfsCid IPFS CID del report
     * @param score Security score 0-100
     */
    function registerAudit(
        string calldata projectName,
        string calldata reportHash,
        string calldata codeReference,
        string calldata ipfsCid,
        uint8 score
    ) external onlyOwner returns (bytes32 auditId) {
        if (bytes(projectName).length == 0) revert EmptyField();
        if (bytes(reportHash).length == 0) revert EmptyField();
        if (score > 100) revert InvalidScore();
        if (_hashToId[reportHash] != bytes32(0)) revert HashAlreadyRegistered();

        auditId = keccak256(abi.encodePacked(
            projectName, reportHash, block.timestamp, msg.sender
        ));

        if (_audits[auditId].timestamp != 0) revert AuditAlreadyExists();

        _audits[auditId] = AuditRecord({
            projectName: projectName,
            reportHash: reportHash,
            codeReference: codeReference,
            ipfsCid: ipfsCid,
            score: score,
            auditor: msg.sender,
            timestamp: block.timestamp,
            valid: true
        });

        _hashToId[reportHash] = auditId;
        _auditIds.push(auditId);
        totalAudits++;

        emit AuditRegistered(
            auditId, projectName, reportHash, ipfsCid, score, msg.sender, block.timestamp
        );
    }

    /**
     * @notice Invalida un audit (se trovati problemi post-audit)
     */
    function invalidateAudit(bytes32 auditId, string calldata reason) external onlyOwner {
        if (_audits[auditId].timestamp == 0) revert AuditNotFound();
        _audits[auditId].valid = false;
        emit AuditInvalidated(auditId, reason);
    }

    // ═══════════════════════════════════════════════════════════════
    // READ FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Verifica un audit tramite ID
     */
    function verifyAudit(bytes32 auditId) external view returns (
        bool exists,
        bool valid,
        string memory projectName,
        string memory reportHash,
        string memory ipfsCid,
        uint8 score,
        uint256 timestamp
    ) {
        AuditRecord memory r = _audits[auditId];
        if (r.timestamp == 0) return (false, false, "", "", "", 0, 0);
        return (true, r.valid, r.projectName, r.reportHash, r.ipfsCid, r.score, r.timestamp);
    }

    /**
     * @notice Verifica un audit tramite report hash
     */
    function verifyByHash(string calldata reportHash) external view returns (
        bool exists,
        bytes32 auditId,
        bool valid,
        uint8 score,
        uint256 timestamp
    ) {
        bytes32 id = _hashToId[reportHash];
        if (id == bytes32(0)) return (false, bytes32(0), false, 0, 0);
        AuditRecord memory r = _audits[id];
        return (true, id, r.valid, r.score, r.timestamp);
    }

    /**
     * @notice Ottieni record completo
     */
    function getAuditRecord(bytes32 auditId) external view returns (AuditRecord memory) {
        if (_audits[auditId].timestamp == 0) revert AuditNotFound();
        return _audits[auditId];
    }

    /**
     * @notice Lista tutti gli audit ID
     */
    function getAllAuditIds() external view returns (bytes32[] memory) {
        return _auditIds;
    }

    /**
     * @notice Numero totale di audit validi
     */
    function getValidAuditCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < _auditIds.length; i++) {
            if (_audits[_auditIds[i]].valid) count++;
        }
    }
}
