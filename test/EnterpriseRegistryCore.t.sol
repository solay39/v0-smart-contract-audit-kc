// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/Solay39EnterpriseRegistry.sol";
contract EnterpriseRegistryTest is Test {
    Solay39EnterpriseRegistry reg;
    function setUp() public { reg = new Solay39EnterpriseRegistry(); }
    function testPublishAudit_and_verifyAudit() public { address[] memory as_ = new address[](2); as_[0]=address(1); as_[1]=address(2); bytes32 id=reg.publishAudit("P1","rh1","commit1",as_); (string memory p,string memory h,,address[] memory got,uint256 ts)=reg.verifyAudit(id); assertEq(p,"P1"); assertEq(h,"rh1"); assertEq(got.length,2); assertGt(ts,0); }
    function testVerifyByReportHash_returnsIdWhenFound() public { address[] memory as_=new address[](1); reg.publishAudit("P2","rh-2","c2",as_); (bool found,bytes32 id)=reg.verifyByReportHash("rh-2"); assertTrue(found); assertTrue(id != bytes32(0)); }
    function testVerifyByReportHash_handlesDuplicateHashes() public {
        address[] memory as_ = new address[](0);
        bytes32 first = reg.publishAudit("P2a", "same-report", "c2a", as_);
        reg.publishAudit("P2b", "same-report", "c2b", as_);
        (bool found, bytes32 id) = reg.verifyByReportHash("same-report");
        assertTrue(found);
        assertEq(id, first);
    }
    function testVerifyByReportHash_missingReturnsFalse() public {
        (bool found, bytes32 id) = reg.verifyByReportHash("missing");
        assertFalse(found);
        assertEq(id, bytes32(0));
    }
    function testPublishAudit_rejectsUnauthorizedTimelockCaller() public {
        reg.setTimelock(address(0xCAFE));
        address[] memory as_ = new address[](0);
        vm.prank(address(0xCAFE));
        vm.expectRevert(Solay39EnterpriseRegistry.NotOwner.selector);
        reg.publishAudit("P4", "rh4", "c4", as_);
    }
    function testGetAuditCount_and_getAllIds() public { address[] memory as_=new address[](1); reg.publishAudit("P3","rh3","c3",as_); reg.publishAudit("P3b","rh3b","c3b",as_); assertEq(reg.getAuditCount(),2); assertEq(reg.getAllAuditIds().length,2); }
    function testPublishSameInputs_multipleIds() public { address[] memory as_=new address[](1); vm.warp(1700000000); bytes32 a=reg.publishAudit("Same","rep","commit",as_); vm.warp(1700000000); bytes32 b=reg.publishAudit("Same","rep","commit",as_); assertTrue(a != b); }
    function testPublishAudit_rejectsUnauthorizedCaller() public {
        address[] memory as_ = new address[](0);
        vm.prank(address(0xBEEF));
        vm.expectRevert(Solay39EnterpriseRegistry.NotOwner.selector);
        reg.publishAudit("P4", "rh4", "c4", as_);
    }
    function testVerifyAudit_nonexistentReverts() public { vm.expectRevert(); reg.verifyAudit(bytes32(uint256(0xdead))); }
}
