// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Solay39AuditRegistry.sol";

contract AccessControlTest is Test {
    Solay39AuditRegistry internal registry;

    function setUp() public {
        registry = new Solay39AuditRegistry();
    }

    function testOnlyOwnerCanRegister() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(Solay39AuditRegistry.OnlyOwner.selector);
        registry.registerAudit("P", "h", "c", "cid", 10);
    }

    function testOwnerCanRegister() public {
        bytes32 auditId = registry.registerAudit("Project", "report", "commit", "cid", 10);
        assertEq(registry.getAllAuditIds().length, 1);
        assertTrue(auditId != bytes32(0));
    }
}
