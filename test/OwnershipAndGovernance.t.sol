// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AuditRegistry.sol";

contract OwnershipAndGovernanceTest is Test {
    AuditRegistry private registry;

    function setUp() public {
        registry = new AuditRegistry();
    }

    function testTransferOwnershipRejectsZeroAddress() public {
        vm.expectRevert(AuditRegistry.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }

    function testTransferOwnershipMovesOwner() public {
        address newOwner = address(0xABCD);
        registry.transferOwnership(newOwner);
        assertEq(registry.owner(), newOwner);
    }

    function testFormerOwnerCannotVerifyAuditor() public {
        address newOwner = address(0xABCD);
        registry.transferOwnership(newOwner);
        vm.expectRevert(AuditRegistry.NotOwner.selector);
        registry.setAuditorVerification(address(0xCAFE), true);
    }

    function testNewOwnerCanVerifyAuditor() public {
        address newOwner = address(0xABCD);
        registry.transferOwnership(newOwner);
        vm.prank(newOwner);
        registry.setAuditorVerification(address(0xCAFE), true);
        assertTrue(registry.verifiedAuditors(address(0xCAFE)));
    }
}
