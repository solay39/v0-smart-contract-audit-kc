// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/Solay39EnterpriseRegistry.sol";
contract CollisionTest is Test {
    Solay39EnterpriseRegistry reg;
    function setUp() public { reg = new Solay39EnterpriseRegistry(); }
    function testIdsDifferOnSameTimestamp() public {
        address[] memory auditors = new address[](1); auditors[0] = address(0x123);
        vm.warp(1_700_000_000);
        bytes32 id1 = reg.publishAudit("ProjectX", "reportHash123", "commitHashABC", auditors);
        vm.warp(1_700_000_000);
        bytes32 id2 = reg.publishAudit("ProjectX", "reportHash123", "commitHashABC", auditors);
        assertEq(reg.getAllAuditIds().length, 2, "expected two ids after second publish");
        assertTrue(id1 != id2, "expected different id for both publishes when nonce included");
    }
}
