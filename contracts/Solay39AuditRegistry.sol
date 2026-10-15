// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Solay39AuditRegistry {
    struct AuditRecord { string projectName; string reportHash; string codeReference; string ipfsCid; uint8 score; address auditor; uint256 timestamp; bool valid; }
    error OnlyOwner(); error EmptyField(); error InvalidScore(); error HashAlreadyRegistered(); error AuditAlreadyExists(); error AuditNotFound();
    address public owner;
    address public timelock;
    uint256 public totalAudits;
    uint256 public auditNonce;
    error ZeroAddress();
    mapping(bytes32 => AuditRecord) private _audits;
    mapping(string => bytes32) private _hashToId;
    bytes32[] private _auditIds;
    event AuditRegistered(bytes32 indexed auditId, string projectName, string reportHash, string ipfsCid, uint8 score, address auditor, uint256 timestamp);
    event AuditInvalidated(bytes32 indexed auditId, string reason);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TimelockUpdated(address indexed previousTimelock, address indexed newTimelock);
    event AuditorVerificationUpdated(address indexed auditor, bool verified);
    event AuditorRegistered(address indexed auditor, string name, string firmName);
    constructor() { owner = msg.sender; }
    modifier onlyOwnerMod() { if (msg.sender != owner) revert OnlyOwner(); _; }
    modifier onlyOwnerOrTimelock() { if (msg.sender != owner && msg.sender != timelock) revert OnlyOwner(); _; }
    function registerAudit(string calldata projectName, string calldata reportHash, string calldata codeReference, string calldata ipfsCid, uint8 score) external onlyOwnerMod returns (bytes32 auditId) {
        if (bytes(projectName).length == 0 || bytes(reportHash).length == 0) revert EmptyField();
        if (score > 100) revert InvalidScore();
        if (_hashToId[reportHash] != bytes32(0)) revert HashAlreadyRegistered();
        auditNonce++;
        auditId = keccak256(abi.encode(auditNonce, msg.sender, projectName, reportHash));
        if (_audits[auditId].timestamp != 0) revert AuditAlreadyExists();
        _audits[auditId] = AuditRecord(projectName, reportHash, codeReference, ipfsCid, score, msg.sender, block.timestamp, true);
        _hashToId[reportHash] = auditId; _auditIds.push(auditId); totalAudits++;
        emit AuditRegistered(auditId, projectName, reportHash, ipfsCid, score, msg.sender, block.timestamp);
    }
    function invalidateAudit(bytes32 auditId, string calldata reason) external onlyOwnerOrTimelock { if (_audits[auditId].timestamp == 0) revert AuditNotFound(); _audits[auditId].valid = false; emit AuditInvalidated(auditId, reason); }
    function verifyAudit(bytes32 auditId) external view returns (bool exists, bool valid, string memory projectName, string memory reportHash, string memory ipfsCid, uint8 score, uint256 timestamp) { AuditRecord memory r = _audits[auditId]; if (r.timestamp == 0) return (false, false, "", "", "", 0, 0); return (true, r.valid, r.projectName, r.reportHash, r.ipfsCid, r.score, r.timestamp); }
    function getAllAuditIds() external view returns (bytes32[] memory) { return _auditIds; }

    function transferOwnership(address newOwner) external onlyOwnerMod {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setTimelock(address newTimelock) external onlyOwnerMod {
        address previousTimelock = timelock;
        timelock = newTimelock;
        emit TimelockUpdated(previousTimelock, newTimelock);
    }
}
