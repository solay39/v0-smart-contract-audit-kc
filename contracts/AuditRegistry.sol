// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Solay39 Audit Registry
 * @notice On-chain registry for smart contract security audit attestations
 * @dev Immutable audit records with cryptographic verification
 * 
 * Deployed addresses:
 * - Ethereum Mainnet: TBD
 * - Sepolia Testnet: TBD  
 * - Base: TBD
 * - Arbitrum: TBD
 */
contract AuditRegistry {
    
    // ══════════════════════════════════════════════════════════════
    //                           STRUCTS
    // ══════════════════════════════════════════════════════════════
    
    struct AuditRecord {
        bytes32 reportHash;           // SHA-256 hash of full audit report
        bytes32 codeHash;             // Keccak256 of audited contract bytecode
        address auditedContract;      // Address of audited contract (0x0 if source-only)
        address auditor;              // Auditor wallet address
        uint256 timestamp;            // Block timestamp of attestation
        uint8 score;                  // Security score (0-100)
        string ipfsCid;               // IPFS CID of full report
        string auditId;               // Solay39 audit ID (e.g., "SOL-2026-...")
        bool isValid;                 // Can be invalidated by auditor if issues found
    }
    
    struct AuditorProfile {
        string name;
        string firmName;
        uint256 totalAudits;
        uint256 registeredAt;
        bool isVerified;              // Verified by Solay39
    }
    
    // ══════════════════════════════════════════════════════════════
    //                           STORAGE
    // ══════════════════════════════════════════════════════════════
    
    /// @notice Registry owner (Solay39)
    address public owner;
    
    /// @notice Mapping from audit ID to audit record
    mapping(string => AuditRecord) public audits;
    
    /// @notice Mapping from report hash to audit ID (for hash lookups)
    mapping(bytes32 => string) public hashToAuditId;
    
    /// @notice Mapping from audited contract address to list of audit IDs
    mapping(address => string[]) public contractAudits;
    
    /// @notice Mapping from auditor address to their profile
    mapping(address => AuditorProfile) public auditors;
    
    /// @notice Mapping from auditor address to list of their audit IDs
    mapping(address => string[]) public auditorAudits;
    
    /// @notice Total number of audits registered
    uint256 public totalAudits;
    
    /// @notice Verified auditors whitelist
    mapping(address => bool) public verifiedAuditors;
    
    // ══════════════════════════════════════════════════════════════
    //                           EVENTS
    // ══════════════════════════════════════════════════════════════
    
    event AuditRegistered(
        string indexed auditId,
        bytes32 indexed reportHash,
        address indexed auditedContract,
        address auditor,
        uint8 score,
        string ipfsCid,
        uint256 timestamp
    );
    
    event AuditInvalidated(
        string indexed auditId,
        address indexed auditor,
        string reason
    );
    
    event AuditorRegistered(
        address indexed auditor,
        string name,
        string firmName
    );
    
    event AuditorVerified(
        address indexed auditor,
        bool verified
    );
    
    // ══════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ══════════════════════════════════════════════════════════════
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyVerifiedAuditor() {
        require(verifiedAuditors[msg.sender] || msg.sender == owner, "Not verified auditor");
        _;
    }
    
    // ══════════════════════════════════════════════════════════════
    //                         CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════
    
    constructor() {
        owner = msg.sender;
        verifiedAuditors[msg.sender] = true;
        
        auditors[msg.sender] = AuditorProfile({
            name: "Solay39 Official",
            firmName: "Solay39 Security",
            totalAudits: 0,
            registeredAt: block.timestamp,
            isVerified: true
        });
    }
    
    // ══════════════════════════════════════════════════════════════
    //                      CORE FUNCTIONS
    // ══════════════════════════════════════════════════════════════
    
    /**
     * @notice Register a new audit attestation on-chain
     * @param auditId Unique audit identifier (e.g., "SOL-2026-CONTRACT-01")
     * @param reportHash SHA-256 hash of the complete audit report
     * @param codeHash Keccak256 hash of audited contract bytecode
     * @param auditedContract Address of audited contract (0x0 if source-only audit)
     * @param score Security score from 0-100
     * @param ipfsCid IPFS content identifier for full report
     */
    function registerAudit(
        string calldata auditId,
        bytes32 reportHash,
        bytes32 codeHash,
        address auditedContract,
        uint8 score,
        string calldata ipfsCid
    ) external onlyVerifiedAuditor {
        require(bytes(auditId).length > 0, "Empty audit ID");
        require(reportHash != bytes32(0), "Empty report hash");
        require(score <= 100, "Score > 100");
        require(audits[auditId].timestamp == 0, "Audit ID exists");
        require(hashToAuditId[reportHash].length == 0, "Report hash exists");
        
        audits[auditId] = AuditRecord({
            reportHash: reportHash,
            codeHash: codeHash,
            auditedContract: auditedContract,
            auditor: msg.sender,
            timestamp: block.timestamp,
            score: score,
            ipfsCid: ipfsCid,
            auditId: auditId,
            isValid: true
        });
        
        hashToAuditId[reportHash] = auditId;
        
        if (auditedContract != address(0)) {
            contractAudits[auditedContract].push(auditId);
        }
        
        auditorAudits[msg.sender].push(auditId);
        auditors[msg.sender].totalAudits++;
        totalAudits++;
        
        emit AuditRegistered(
            auditId,
            reportHash,
            auditedContract,
            msg.sender,
            score,
            ipfsCid,
            block.timestamp
        );
    }
    
    /**
     * @notice Invalidate an audit (only by original auditor)
     * @param auditId Audit ID to invalidate
     * @param reason Reason for invalidation
     */
    function invalidateAudit(
        string calldata auditId,
        string calldata reason
    ) external {
        AuditRecord storage audit = audits[auditId];
        require(audit.timestamp != 0, "Audit not found");
        require(audit.auditor == msg.sender || msg.sender == owner, "Not authorized");
        require(audit.isValid, "Already invalidated");
        
        audit.isValid = false;
        
        emit AuditInvalidated(auditId, msg.sender, reason);
    }
    
    // ══════════════════════════════════════════════════════════════
    //                      VERIFICATION FUNCTIONS
    // ══════════════════════════════════════════════════════════════
    
    /**
     * @notice Verify an audit by its report hash
     * @param reportHash SHA-256 hash of the audit report
     * @return exists Whether the audit exists
     * @return isValid Whether the audit is still valid
     * @return auditId The audit ID
     * @return auditor The auditor address
     * @return score The security score
     * @return timestamp When the audit was registered
     */
    function verifyByHash(bytes32 reportHash) external view returns (
        bool exists,
        bool isValid,
        string memory auditId,
        address auditor,
        uint8 score,
        uint256 timestamp
    ) {
        string memory id = hashToAuditId[reportHash];
        if (bytes(id).length == 0) {
            return (false, false, "", address(0), 0, 0);
        }
        
        AuditRecord storage audit = audits[id];
        return (
            true,
            audit.isValid,
            id,
            audit.auditor,
            audit.score,
            audit.timestamp
        );
    }
    
    /**
     * @notice Verify an audit by its ID
     * @param auditId The audit ID to verify
     */
    function verifyById(string calldata auditId) external view returns (
        bool exists,
        bool isValid,
        bytes32 reportHash,
        address auditedContract,
        address auditor,
        uint8 score,
        string memory ipfsCid,
        uint256 timestamp
    ) {
        AuditRecord storage audit = audits[auditId];
        if (audit.timestamp == 0) {
            return (false, false, bytes32(0), address(0), address(0), 0, "", 0);
        }
        
        return (
            true,
            audit.isValid,
            audit.reportHash,
            audit.auditedContract,
            audit.auditor,
            audit.score,
            audit.ipfsCid,
            audit.timestamp
        );
    }
    
    /**
     * @notice Check if a contract has been audited
     * @param contractAddress The contract address to check
     */
    function isContractAudited(address contractAddress) external view returns (
        bool audited,
        uint256 auditCount,
        string memory latestAuditId
    ) {
        string[] storage auditIds = contractAudits[contractAddress];
        if (auditIds.length == 0) {
            return (false, 0, "");
        }
        
        return (true, auditIds.length, auditIds[auditIds.length - 1]);
    }
    
    /**
     * @notice Get all audit IDs for a contract
     */
    function getContractAudits(address contractAddress) external view returns (string[] memory) {
        return contractAudits[contractAddress];
    }
    
    /**
     * @notice Get all audit IDs by an auditor
     */
    function getAuditorAudits(address auditor) external view returns (string[] memory) {
        return auditorAudits[auditor];
    }
    
    // ══════════════════════════════════════════════════════════════
    //                      AUDITOR MANAGEMENT
    // ══════════════════════════════════════════════════════════════
    
    /**
     * @notice Register as an auditor
     */
    function registerAuditor(string calldata name, string calldata firmName) external {
        require(auditors[msg.sender].registeredAt == 0, "Already registered");
        
        auditors[msg.sender] = AuditorProfile({
            name: name,
            firmName: firmName,
            totalAudits: 0,
            registeredAt: block.timestamp,
            isVerified: false
        });
        
        emit AuditorRegistered(msg.sender, name, firmName);
    }
    
    /**
     * @notice Verify/unverify an auditor (owner only)
     */
    function setAuditorVerification(address auditor, bool verified) external onlyOwner {
        verifiedAuditors[auditor] = verified;
        auditors[auditor].isVerified = verified;
        
        emit AuditorVerified(auditor, verified);
    }
    
    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
