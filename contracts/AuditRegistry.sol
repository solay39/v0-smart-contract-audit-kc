// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AuditRegistry {
    struct AuditRecord { bytes32 reportHash; bytes32 codeHash; address auditedContract; address auditor; uint256 timestamp; uint8 score; string ipfsCid; string auditId; bool isValid; }
    struct AuditorProfile { string name; string firmName; uint256 totalAudits; uint256 registeredAt; bool isVerified; }
    error NotOwner(); error NotVerifiedAuditor(); error EmptyAuditId(); error EmptyReportHash(); error ScoreTooHigh(); error AuditIdExists(); error ReportHashExists(); error AuditNotFound(); error AlreadyInvalidated(); error AlreadyRegistered(); error ZeroAddress(); error NotAuthorized();
    address public owner;
    address public timelock;
    mapping(string => AuditRecord) public audits;
    mapping(bytes32 => string) public hashToAuditId;
    mapping(address => string[]) public contractAudits;
    mapping(address => AuditorProfile) public auditors;
    mapping(address => string[]) public auditorAudits;
    uint256 public totalAudits; uint256 public auditNonce;
    mapping(address => bool) public verifiedAuditors;
    event AuditRegistered(string indexed auditId, bytes32 indexed reportHash, address indexed auditedContract, address auditor, uint8 score, string ipfsCid, uint256 timestamp);
    event AuditInvalidated(string indexed auditId, address indexed actor, string reason);
    event AuditorRegistered(address indexed auditor, string name, string firmName);
    event AuditorVerified(address indexed auditor, bool verified);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TimelockUpdated(address indexed previousTimelock, address indexed newTimelock);
    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    modifier onlyVerifiedAuditor() { if (!verifiedAuditors[msg.sender] && msg.sender != owner) revert NotVerifiedAuditor(); _; }
    constructor() { owner = msg.sender; verifiedAuditors[msg.sender] = true; auditors[msg.sender] = AuditorProfile("Solay39 Official", "Solay39 Security", 0, block.timestamp, true); }
    function registerAudit(string calldata auditId, bytes32 reportHash, bytes32 codeHash, address auditedContract, uint8 score, string calldata ipfsCid) external onlyVerifiedAuditor { if (bytes(auditId).length == 0) revert EmptyAuditId(); if (reportHash == bytes32(0)) revert EmptyReportHash(); if (score > 100) revert ScoreTooHigh(); if (audits[auditId].timestamp != 0) revert AuditIdExists(); if (bytes(hashToAuditId[reportHash]).length != 0) revert ReportHashExists(); _store(auditId, reportHash, codeHash, auditedContract, score, ipfsCid); }
    function registerAuditAuto(bytes32 reportHash, bytes32 codeHash, address auditedContract, uint8 score, string calldata ipfsCid) external onlyVerifiedAuditor { if (reportHash == bytes32(0)) revert EmptyReportHash(); if (score > 100) revert ScoreTooHigh(); if (bytes(hashToAuditId[reportHash]).length != 0) revert ReportHashExists(); auditNonce++;
        bytes32 raw = keccak256(abi.encode(auditNonce, msg.sender, reportHash, codeHash));
        _store(_toHexString(raw), reportHash, codeHash, auditedContract, score, ipfsCid); }
    function _store(string memory auditId, bytes32 reportHash, bytes32 codeHash, address auditedContract, uint8 score, string memory ipfsCid) internal { audits[auditId] = AuditRecord(reportHash, codeHash, auditedContract, msg.sender, block.timestamp, score, ipfsCid, auditId, true); hashToAuditId[reportHash] = auditId; if (auditedContract != address(0)) contractAudits[auditedContract].push(auditId); auditorAudits[msg.sender].push(auditId); auditors[msg.sender].totalAudits++; totalAudits++; emit AuditRegistered(auditId, reportHash, auditedContract, msg.sender, score, ipfsCid, block.timestamp); }
    function invalidateAudit(string calldata auditId, string calldata reason) external { AuditRecord storage a = audits[auditId]; if (a.timestamp == 0) revert AuditNotFound(); if (a.auditor != msg.sender && msg.sender != owner && msg.sender != timelock) revert NotAuthorized(); if (!a.isValid) revert AlreadyInvalidated(); a.isValid = false; emit AuditInvalidated(auditId, msg.sender, reason); }
    function verifyByHash(bytes32 reportHash) external view returns (bool, bool, string memory, address, uint8, uint256) { string memory id = hashToAuditId[reportHash]; if (bytes(id).length == 0) return (false, false, "", address(0), 0, 0); AuditRecord storage a = audits[id]; return (true, a.isValid, id, a.auditor, a.score, a.timestamp); }
    function verifyById(string calldata id) external view returns (bool, bool, bytes32, address, address, uint8, string memory, uint256) { AuditRecord storage a = audits[id]; if (a.timestamp == 0) return (false, false, bytes32(0), address(0), address(0), 0, "", 0); return (true, a.isValid, a.reportHash, a.auditedContract, a.auditor, a.score, a.ipfsCid, a.timestamp); }
    function isContractAudited(address c) external view returns (bool, uint256, string memory) { string[] storage ids = contractAudits[c]; if (ids.length == 0) return (false, 0, ""); return (true, ids.length, ids[ids.length - 1]); }
    function getContractAudits(address c) external view returns (string[] memory) { return contractAudits[c]; }
    function getAuditorAudits(address a) external view returns (string[] memory) { return auditorAudits[a]; }
    function registerAuditor(string calldata name, string calldata firmName) external { if (auditors[msg.sender].registeredAt != 0) revert AlreadyRegistered(); auditors[msg.sender] = AuditorProfile(name, firmName, 0, block.timestamp, false); emit AuditorRegistered(msg.sender, name, firmName); }
    function setAuditorVerification(address auditor, bool verified) external onlyOwner { verifiedAuditors[auditor] = verified; auditors[auditor].isVerified = verified; emit AuditorVerified(auditor, verified); }
    function transferOwnership(address newOwner) external onlyOwner { if (newOwner == address(0)) revert ZeroAddress(); address previousOwner = owner; owner = newOwner; emit OwnershipTransferred(previousOwner, newOwner); }
    function setTimelock(address newTimelock) external onlyOwner { address previousTimelock = timelock; timelock = newTimelock; emit TimelockUpdated(previousTimelock, newTimelock); }
    function _toHexString(bytes32 data) internal pure returns (string memory) { bytes memory alphabet = "0123456789abcdef"; bytes memory str = new bytes(64); for (uint i; i < 32; i++) { str[i*2] = alphabet[uint8(data[i] >> 4)]; str[i*2+1] = alphabet[uint8(data[i] & 0x0f)]; } return string(str); }
}
