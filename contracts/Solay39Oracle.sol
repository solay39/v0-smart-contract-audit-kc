// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOLAY39 Security Oracle
 * 
 * On-chain publication of SOLAY39 audit scores.
 * Allows any protocol to verify their audit status on-chain.
 * 
 * Features:
 * - Publish audit scores (0-100) with metadata
 * - Verify scores are authentic via signer validation
 * - Query historical audits
 * - Integration with DeFi protocols for security gates
 * ═══════════════════════════════════════════════════════════════════════════════
 */

contract Solay39Oracle is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─── Structs ──────────────────────────────────────────────────────────────────

    struct AuditRecord {
        address contractAddress;    // Audited contract
        uint8 score;               // 0-100 SOLAY39 score
        string rating;             // AAA, AA, A, B, C, D
        uint256 criticals;         // Critical findings count
        uint256 highs;             // High findings count
        uint256 mediums;           // Medium findings count
        uint256 lows;              // Low findings count
        string reportHash;         // SHA256 hash of full report
        string reportUrl;          // IPFS or GitHub URL
        uint256 timestamp;         // When audit was published
        uint256 expiresAt;         // Validity period (0 = never expires)
        bool isActive;             // Can be revoked
    }

    struct ScoreBreakdown {
        uint8 codeSecurity;        // 0-100
        uint8 architectureRisk;    // 0-100
        uint8 centralization;      // 0-100
        uint8 governanceRisk;      // 0-100
        uint8 testingCoverage;     // 0-100
        uint8 externalRisk;        // 0-100
    }

    // ─── State ────────────────────────────────────────────────────────────────────

    // Authorized signers (SOLAY39 audit keys)
    mapping(address => bool) public authorizedSigners;
    
    // Contract address => Audit record
    mapping(address => AuditRecord) public audits;
    
    // Contract address => Score breakdown
    mapping(address => ScoreBreakdown) public scoreBreakdowns;
    
    // All audited contracts (for enumeration)
    address[] public auditedContracts;
    mapping(address => bool) public hasAudit;
    
    // Statistics
    uint256 public totalAudits;
    uint256 public totalCriticals;
    uint256 public totalHighs;

    // ─── Events ───────────────────────────────────────────────────────────────────

    event AuditPublished(
        address indexed contractAddress,
        uint8 score,
        string rating,
        string reportHash,
        uint256 timestamp
    );
    
    event AuditRevoked(address indexed contractAddress, string reason);
    event AuditUpdated(address indexed contractAddress, uint8 newScore, string newRating);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);

    // ─── Modifiers ────────────────────────────────────────────────────────────────

    modifier onlyAuthorizedSigner() {
        require(authorizedSigners[msg.sender], "Not authorized signer");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────────

    constructor(address initialSigner) Ownable(msg.sender) {
        authorizedSigners[initialSigner] = true;
        authorizedSigners[msg.sender] = true;
        emit SignerAdded(initialSigner);
        emit SignerAdded(msg.sender);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────────

    function addSigner(address signer) external onlyOwner {
        require(signer != address(0), "Invalid signer");
        authorizedSigners[signer] = true;
        emit SignerAdded(signer);
    }

    function removeSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    // ─── Core Functions ───────────────────────────────────────────────────────────

    /**
     * @notice Publish a new audit score
     * @param contractAddress The audited contract address
     * @param score SOLAY39 score (0-100)
     * @param rating Rating string (AAA, AA, A, B, C, D)
     * @param criticals Number of critical findings
     * @param highs Number of high findings
     * @param mediums Number of medium findings
     * @param lows Number of low findings
     * @param reportHash SHA256 hash of the full report
     * @param reportUrl URL to the full report (GitHub/IPFS)
     * @param validityDays Days until audit expires (0 = never)
     */
    function publishAudit(
        address contractAddress,
        uint8 score,
        string calldata rating,
        uint256 criticals,
        uint256 highs,
        uint256 mediums,
        uint256 lows,
        string calldata reportHash,
        string calldata reportUrl,
        uint256 validityDays
    ) external onlyAuthorizedSigner {
        require(contractAddress != address(0), "Invalid contract address");
        require(score <= 100, "Score must be 0-100");
        require(bytes(reportHash).length > 0, "Report hash required");

        uint256 expiresAt = validityDays > 0 
            ? block.timestamp + (validityDays * 1 days) 
            : 0;

        audits[contractAddress] = AuditRecord({
            contractAddress: contractAddress,
            score: score,
            rating: rating,
            criticals: criticals,
            highs: highs,
            mediums: mediums,
            lows: lows,
            reportHash: reportHash,
            reportUrl: reportUrl,
            timestamp: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });

        if (!hasAudit[contractAddress]) {
            auditedContracts.push(contractAddress);
            hasAudit[contractAddress] = true;
            totalAudits++;
        }

        totalCriticals += criticals;
        totalHighs += highs;

        emit AuditPublished(contractAddress, score, rating, reportHash, block.timestamp);
    }

    /**
     * @notice Publish score breakdown details
     */
    function publishScoreBreakdown(
        address contractAddress,
        uint8 codeSecurity,
        uint8 architectureRisk,
        uint8 centralization,
        uint8 governanceRisk,
        uint8 testingCoverage,
        uint8 externalRisk
    ) external onlyAuthorizedSigner {
        require(hasAudit[contractAddress], "No audit exists");
        
        scoreBreakdowns[contractAddress] = ScoreBreakdown({
            codeSecurity: codeSecurity,
            architectureRisk: architectureRisk,
            centralization: centralization,
            governanceRisk: governanceRisk,
            testingCoverage: testingCoverage,
            externalRisk: externalRisk
        });
    }

    /**
     * @notice Revoke an audit (e.g., critical vulnerability discovered post-audit)
     */
    function revokeAudit(address contractAddress, string calldata reason) external onlyAuthorizedSigner {
        require(hasAudit[contractAddress], "No audit exists");
        audits[contractAddress].isActive = false;
        emit AuditRevoked(contractAddress, reason);
    }

    /**
     * @notice Update an existing audit score
     */
    function updateAudit(
        address contractAddress,
        uint8 newScore,
        string calldata newRating,
        uint256 criticals,
        uint256 highs,
        uint256 mediums,
        uint256 lows
    ) external onlyAuthorizedSigner {
        require(hasAudit[contractAddress], "No audit exists");
        
        AuditRecord storage record = audits[contractAddress];
        record.score = newScore;
        record.rating = newRating;
        record.criticals = criticals;
        record.highs = highs;
        record.mediums = mediums;
        record.lows = lows;
        record.timestamp = block.timestamp;
        record.isActive = true;

        emit AuditUpdated(contractAddress, newScore, newRating);
    }

    // ─── View Functions ───────────────────────────────────────────────────────────

    /**
     * @notice Get audit score for a contract
     * @return score The SOLAY39 score (0-100), or 0 if not audited
     * @return isValid Whether the audit is active and not expired
     */
    function getScore(address contractAddress) external view returns (uint8 score, bool isValid) {
        if (!hasAudit[contractAddress]) {
            return (0, false);
        }
        
        AuditRecord memory record = audits[contractAddress];
        bool notExpired = record.expiresAt == 0 || block.timestamp <= record.expiresAt;
        
        return (record.score, record.isActive && notExpired);
    }

    /**
     * @notice Check if a contract meets minimum security requirements
     * @param contractAddress The contract to check
     * @param minScore Minimum required score (e.g., 70)
     * @param maxCriticals Maximum allowed critical findings (e.g., 0)
     * @return passes Whether the contract meets requirements
     */
    function meetsRequirements(
        address contractAddress,
        uint8 minScore,
        uint256 maxCriticals
    ) external view returns (bool passes) {
        if (!hasAudit[contractAddress]) return false;
        
        AuditRecord memory record = audits[contractAddress];
        
        // Check active and not expired
        if (!record.isActive) return false;
        if (record.expiresAt > 0 && block.timestamp > record.expiresAt) return false;
        
        // Check requirements
        return record.score >= minScore && record.criticals <= maxCriticals;
    }

    /**
     * @notice Get full audit record
     */
    function getAudit(address contractAddress) external view returns (AuditRecord memory) {
        return audits[contractAddress];
    }

    /**
     * @notice Get score breakdown
     */
    function getScoreBreakdown(address contractAddress) external view returns (ScoreBreakdown memory) {
        return scoreBreakdowns[contractAddress];
    }

    /**
     * @notice Get all audited contracts
     */
    function getAllAuditedContracts() external view returns (address[] memory) {
        return auditedContracts;
    }

    /**
     * @notice Get number of audited contracts
     */
    function getAuditCount() external view returns (uint256) {
        return auditedContracts.length;
    }

    /**
     * @notice Verify a report hash matches the on-chain record
     */
    function verifyReportHash(address contractAddress, string calldata hash) external view returns (bool) {
        if (!hasAudit[contractAddress]) return false;
        return keccak256(bytes(audits[contractAddress].reportHash)) == keccak256(bytes(hash));
    }

    // ─── Signature Verification (for off-chain score verification) ────────────────

    /**
     * @notice Verify an off-chain signed score
     * @param contractAddress The audited contract
     * @param score The claimed score
     * @param timestamp When the score was signed
     * @param signature The ECDSA signature
     */
    function verifySignedScore(
        address contractAddress,
        uint8 score,
        uint256 timestamp,
        bytes calldata signature
    ) external view returns (bool isValid, address signer) {
        // Recreate the message hash
        bytes32 messageHash = keccak256(abi.encodePacked(
            "SOLAY39_SCORE:",
            contractAddress,
            score,
            timestamp
        ));
        
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(signature);
        
        return (authorizedSigners[recoveredSigner], recoveredSigner);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOLAY39 Security Gate
 * 
 * Example integration contract that gates functionality based on audit scores.
 * DeFi protocols can inherit or use this to require security audits.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

contract Solay39SecurityGate {
    Solay39Oracle public immutable oracle;
    
    uint8 public minRequiredScore;
    uint256 public maxAllowedCriticals;
    
    constructor(address oracleAddress, uint8 _minScore, uint256 _maxCriticals) {
        oracle = Solay39Oracle(oracleAddress);
        minRequiredScore = _minScore;
        maxAllowedCriticals = _maxCriticals;
    }
    
    modifier onlyAuditedContract(address target) {
        require(
            oracle.meetsRequirements(target, minRequiredScore, maxAllowedCriticals),
            "Contract does not meet SOLAY39 security requirements"
        );
        _;
    }
    
    /**
     * @notice Example: Only allow interactions with audited contracts
     */
    function safeInteract(address target) external view onlyAuditedContract(target) returns (bool) {
        // Your protocol logic here
        return true;
    }
    
    /**
     * @notice Check if a contract is safe to interact with
     */
    function isSafe(address target) external view returns (bool) {
        return oracle.meetsRequirements(target, minRequiredScore, maxAllowedCriticals);
    }
}
