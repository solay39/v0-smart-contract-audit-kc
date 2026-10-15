// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/AuditRegistry.sol";
contract AuditRegistryCoreTest is Test {
    AuditRegistry reg;
    function setUp() public { reg = new AuditRegistry(); }
    function testRegisterAuditAuto_happyPath() public { bytes32 h=keccak256("report1"); reg.registerAuditAuto(h,keccak256("code1"),address(0x123),90,"ipfs://cid1"); (bool exists,,string memory id,,uint8 score,) = reg.verifyByHash(h); assertTrue(exists); assertEq(score,90); assertTrue(bytes(id).length > 0); }
    function testRegisterAuditAuto_duplicateReportHash_reverts() public { bytes32 h=keccak256("dup"); reg.registerAuditAuto(h,bytes32(0),address(0x1),50,"cid"); vm.expectRevert(); reg.registerAuditAuto(h,bytes32(0),address(0x2),60,"cid2"); }
    function testVerifyById_nonexistentReturnsFalse() public { (bool exists,,,,,,,) = reg.verifyById("none"); assertFalse(exists); }
    function testInvalidate_byOwner() public { bytes32 h=keccak256("rep"); reg.registerAuditAuto(h,bytes32(0),address(this),70,"cid"); (,,string memory id,,,) = reg.verifyByHash(h); reg.invalidateAudit(id,"fix"); (,bool valid,,,,,,) = reg.verifyById(id); assertFalse(valid); }
    function testRegisterAuditor_and_setVerification() public { address a=address(0xAB); vm.prank(a); reg.registerAuditor("Alice","Firm"); reg.setAuditorVerification(a,true); vm.prank(a); reg.registerAuditAuto(keccak256("a"),bytes32(0),address(0),80,"cid"); (bool exists,,,,,) = reg.verifyByHash(keccak256("a")); assertTrue(exists); }
    function testIsContractAudited_returnsCorrect() public { address c=address(0xCAFE); reg.registerAuditAuto(keccak256("c"),bytes32(0),c,10,"cid"); (bool audited,uint256 count,string memory id)=reg.isContractAudited(c); assertTrue(audited); assertEq(count,1); assertTrue(bytes(id).length>0); }
}
