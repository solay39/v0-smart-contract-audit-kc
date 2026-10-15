// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AuditRegistry.sol";

contract RegistryEdgeCasesTest is Test {
    AuditRegistry private registry;

    function setUp() public {
        registry = new AuditRegistry();
    }

    function testRegisterAuditAutoRejectsEmptyReportHash() public {
        vm.expectRevert(AuditRegistry.EmptyReportHash.selector);
        registry.registerAuditAuto(bytes32(0), keccak256("code"), address(0), 50, "cid");
    }

    function testRegisterAuditAutoRejectsScoreAbove100() public {
        vm.expectRevert(AuditRegistry.ScoreTooHigh.selector);
        registry.registerAuditAuto(keccak256("report"), keccak256("code"), address(0), 101, "cid");
    }

    function testUnauthorizedInvalidationReverts() public {
        bytes32 reportHash = keccak256("report");
        registry.registerAuditAuto(reportHash, keccak256("code"), address(0), 80, "cid");
        (,, string memory auditId,,,) = registry.verifyByHash(reportHash);

        vm.prank(address(0xBEEF));
        vm.expectRevert(AuditRegistry.NotAuthorized.selector);
        registry.invalidateAudit(auditId, "unauthorized");
    }

    function testDuplicateAuditorRegistrationReverts() public {
        address auditor = address(0xA11CE);
        vm.prank(auditor);
        registry.registerAuditor("Alice", "Firm");

        vm.prank(auditor);
        vm.expectRevert(AuditRegistry.AlreadyRegistered.selector);
        registry.registerAuditor("Alice", "Firm");
    }
}

contract RegistryEdgeCasesCaller {
    AuditRegistry private immutable registry;

    constructor(AuditRegistry target) {
        registry = target;
    }

    function invalidate(string calldata auditId) external {
        registry.invalidateAudit(auditId, "caller");
    }
}

contract RegistryEdgeCasesAuthorizedTest is Test {
    AuditRegistry private registry;
    RegistryEdgeCasesCaller private caller;

    function setUp() public {
        registry = new AuditRegistry();
        caller = new RegistryEdgeCasesCaller(registry);
    }

    function testAuditorCanInvalidateOwnAudit() public {
        vm.prank(address(caller));
        registry.registerAuditor("Auditor", "Firm");
        registry.setAuditorVerification(address(caller), true);
        vm.prank(address(caller));
        registry.registerAuditAuto(keccak256("report"), keccak256("code"), address(0), 90, "cid");
        (,, string memory auditId,,,) = registry.verifyByHash(keccak256("report"));

        caller.invalidate(auditId);
        (bool exists, bool valid,,,,,,) = registry.verifyById(auditId);
        assertTrue(exists);
        assertFalse(valid);
    }
}
