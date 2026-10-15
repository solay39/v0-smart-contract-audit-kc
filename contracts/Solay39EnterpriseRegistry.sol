// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Solay39EnterpriseRegistry {
    struct Audit { string project; string reportHash; string commitHash; address[] auditors; uint256 timestamp; }
    mapping(bytes32 => Audit) public audits;
    mapping(bytes32 => bytes32[]) private _auditIdsByReportHash;
    bytes32[] private _auditIds;
    uint256 public auditNonce;
    address public owner;
    address public timelock;
    error AuditNotFound();
    error NotOwner();
    error ZeroAddress();
    event AuditPublished(bytes32 indexed id, string project);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TimelockUpdated(address indexed previousTimelock, address indexed newTimelock);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOwnerOrTimelock() {
        if (msg.sender != owner && msg.sender != timelock) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function publishAudit(string memory project, string memory reportHash, string memory commitHash, address[] memory auditors) public onlyOwner returns (bytes32 id) {
        auditNonce++;
        id = keccak256(abi.encode(auditNonce, msg.sender, project, reportHash, commitHash));
        audits[id] = Audit(project, reportHash, commitHash, auditors, block.timestamp);
        bytes32 reportKey = keccak256(bytes(reportHash));
        _auditIdsByReportHash[reportKey].push(id);
        _auditIds.push(id);
        emit AuditPublished(id, project);
    }

    function verifyAudit(bytes32 id) external view returns (string memory, string memory, string memory, address[] memory, uint256) {
        Audit storage a = audits[id];
        if (a.timestamp == 0) revert AuditNotFound();
        return (a.project, a.reportHash, a.commitHash, a.auditors, a.timestamp);
    }
    function verifyByReportHash(string calldata reportHash) external view returns (bool found, bytes32 id) {
        bytes32[] storage matchingIds = _auditIdsByReportHash[keccak256(bytes(reportHash))];
        if (matchingIds.length != 0) return (true, matchingIds[0]);
        return (false, bytes32(0));
    }
    function getAuditCount() external view returns (uint256) { return _auditIds.length; }
    function getAllAuditIds() external view returns (bytes32[] memory) { return _auditIds; }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setTimelock(address newTimelock) external onlyOwner {
        address previousTimelock = timelock;
        timelock = newTimelock;
        emit TimelockUpdated(previousTimelock, newTimelock);
    }
}
