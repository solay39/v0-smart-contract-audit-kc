// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/Solay39EnterpriseRegistry.sol";
contract FuzzAudit is Test {
    Solay39EnterpriseRegistry reg;
    function setUp() public { reg = new Solay39EnterpriseRegistry(); }
    function testFuzz_publishAudit(bytes calldata project, bytes calldata reportHash, bytes calldata commitHash, address auditorAddr) public {
        vm.assume(project.length > 0 && project.length < 200);
        vm.assume(reportHash.length > 0 && reportHash.length < 200);
        address[] memory auditors = new address[](1);
        auditors[0] = auditorAddr == address(0) ? address(this) : auditorAddr;
        reg.publishAudit(string(project), string(reportHash), string(commitHash), auditors);
        assertGe(reg.getAuditCount(), 1);
    }
}
