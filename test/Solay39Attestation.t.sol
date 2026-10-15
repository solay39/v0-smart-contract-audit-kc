// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Solay39Attestation.sol";

contract Solay39AttestationTest is Test {
    Solay39Attestation internal att;

    address internal constant AUDITOR_A = address(0xA11CE);
    address internal constant AUDITOR_B = address(0xB0B);
    address internal constant AUDITOR_C = address(0xC0C);

    event AuditAttested(
        bytes32 indexed id,
        string project,
        string reportHash,
        address[] auditors,
        bool dualReview,
        uint256 timestamp
    );

    function setUp() public {
        att = new Solay39Attestation();
    }

    function _auditors(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _auditors(address a, address b) internal pure returns (address[] memory arr) {
        arr = new address[](2);
        arr[0] = a;
        arr[1] = b;
    }

    // --- Deployment ---

    function testOwnerIsDeployer() public view {
        assertEq(att.owner(), address(this));
        assertEq(att.totalAttestations(), 0);
        assertEq(att.getAllAttestationIds().length, 0);
    }

    // --- Access control ---

    function testNonOwnerCannotAttest() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(Solay39Attestation.OnlyOwner.selector);
        att.attestAudit("P", "h", "c", _auditors(AUDITOR_A));
    }

    function testFuzzNonOwnerCannotAttest(address caller) public {
        vm.assume(caller != address(this));
        vm.prank(caller);
        vm.expectRevert(Solay39Attestation.OnlyOwner.selector);
        att.attestAudit("P", "h", "c", _auditors(AUDITOR_A));
    }

    // --- Input validation ---

    function testRevertsOnEmptyProject() public {
        vm.expectRevert(abi.encodeWithSelector(Solay39Attestation.EmptyField.selector, "project"));
        att.attestAudit("", "h", "c", _auditors(AUDITOR_A));
    }

    function testRevertsOnEmptyReportHash() public {
        vm.expectRevert(abi.encodeWithSelector(Solay39Attestation.EmptyField.selector, "reportHash"));
        att.attestAudit("P", "", "c", _auditors(AUDITOR_A));
    }

    function testRevertsOnNoAuditors() public {
        vm.expectRevert(Solay39Attestation.NoAuditors.selector);
        att.attestAudit("P", "h", "c", new address[](0));
    }

    function testEmptyCommitHashIsAccepted() public {
        bytes32 id = att.attestAudit("P", "h", "", _auditors(AUDITOR_A));
        (, , string memory commitHash, , , ) = att.verifyAttestation(id);
        assertEq(commitHash, "");
    }

    // --- Happy path ---

    function testAttestStoresAllFields() public {
        vm.warp(1_700_000_000);
        bytes32 id = att.attestAudit("Solay39", "sha256:abc", "0xdead", _auditors(AUDITOR_A, AUDITOR_B));

        assertEq(id, keccak256(abi.encodePacked("Solay39", "sha256:abc", uint256(1_700_000_000))));

        (
            string memory project,
            string memory reportHash,
            string memory commitHash,
            address[] memory auditors,
            uint256 timestamp,
            bool dualReview
        ) = att.verifyAttestation(id);

        assertEq(project, "Solay39");
        assertEq(reportHash, "sha256:abc");
        assertEq(commitHash, "0xdead");
        assertEq(auditors.length, 2);
        assertEq(auditors[0], AUDITOR_A);
        assertEq(auditors[1], AUDITOR_B);
        assertEq(timestamp, 1_700_000_000);
        assertTrue(dualReview);

        assertEq(att.totalAttestations(), 1);
        bytes32[] memory ids = att.getAllAttestationIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], id);
    }

    function testEmitsAuditAttested() public {
        vm.warp(1_700_000_000);
        address[] memory auditors = _auditors(AUDITOR_A, AUDITOR_B);
        bytes32 expectedId = keccak256(abi.encodePacked("P", "h", uint256(1_700_000_000)));

        vm.expectEmit(true, false, false, true, address(att));
        emit AuditAttested(expectedId, "P", "h", auditors, true, 1_700_000_000);
        att.attestAudit("P", "h", "c", auditors);
    }

    // --- Dual review logic ---

    function testSingleAuditorIsNotDualReview() public {
        bytes32 id = att.attestAudit("P", "h", "c", _auditors(AUDITOR_A));
        (, , , , , bool dual) = att.verifyAttestation(id);
        assertFalse(dual);
    }

    function testDuplicateAuditorDoesNotCountAsDualReview() public {
        bytes32 id = att.attestAudit("P", "h", "c", _auditors(AUDITOR_A, AUDITOR_A));
        (, , , , , bool dual) = att.verifyAttestation(id);
        assertFalse(dual, "same wallet twice must not qualify as dual review");
    }

    function testThreeAuditorsWithOneDuplicateIsDualReview() public {
        address[] memory arr = new address[](3);
        arr[0] = AUDITOR_A;
        arr[1] = AUDITOR_A;
        arr[2] = AUDITOR_C;
        bytes32 id = att.attestAudit("P", "h", "c", arr);
        (, , , , , bool dual) = att.verifyAttestation(id);
        assertTrue(dual);
    }

    function testFuzzDualReviewMatchesUniqueCount(address a, address b) public {
        bytes32 id = att.attestAudit("P", "h", "c", _auditors(a, b));
        (, , , , , bool dual) = att.verifyAttestation(id);
        assertEq(dual, a != b);
    }

    // --- Duplicates / collisions ---

    function testSameProjectAndHashInSameBlockReverts() public {
        bytes32 id = att.attestAudit("P", "h", "c", _auditors(AUDITOR_A));
        vm.expectRevert(abi.encodeWithSelector(Solay39Attestation.AttestationExists.selector, id));
        att.attestAudit("P", "h", "other-commit", _auditors(AUDITOR_B));
    }

    function testSameProjectAndHashInLaterBlockSucceeds() public {
        bytes32 id1 = att.attestAudit("P", "h", "c", _auditors(AUDITOR_A));
        vm.warp(block.timestamp + 1);
        bytes32 id2 = att.attestAudit("P", "h", "c", _auditors(AUDITOR_A));
        assertTrue(id1 != id2);
        assertEq(att.totalAttestations(), 2);
    }

    /// @dev Documents the abi.encodePacked ambiguity: ("ab","c") and ("a","bc")
    ///      hash to the same id, so the second, distinct attestation is blocked.
    function testEncodePackedCollisionBlocksDistinctAttestation() public {
        bytes32 id = att.attestAudit("ab", "c", "x", _auditors(AUDITOR_A));
        vm.expectRevert(abi.encodeWithSelector(Solay39Attestation.AttestationExists.selector, id));
        att.attestAudit("a", "bc", "x", _auditors(AUDITOR_A));
    }

    // --- Reads ---

    function testVerifyUnknownIdReverts() public {
        vm.expectRevert(bytes("Attestation not found"));
        att.verifyAttestation(bytes32(uint256(1)));
    }

    function testVerifyByReportHashFindsMatch() public {
        att.attestAudit("P1", "hash-1", "c", _auditors(AUDITOR_A));
        bytes32 id2 = att.attestAudit("P2", "hash-2", "c", _auditors(AUDITOR_B));

        (bool found, bytes32 id) = att.verifyByReportHash("hash-2");
        assertTrue(found);
        assertEq(id, id2);
    }

    function testVerifyByReportHashMissing() public {
        att.attestAudit("P1", "hash-1", "c", _auditors(AUDITOR_A));
        (bool found, bytes32 id) = att.verifyByReportHash("nope");
        assertFalse(found);
        assertEq(id, bytes32(0));
    }

    function testVerifyByReportHashReturnsFirstOfDuplicates() public {
        bytes32 first = att.attestAudit("P", "dup", "c", _auditors(AUDITOR_A));
        vm.warp(block.timestamp + 1);
        att.attestAudit("P", "dup", "c", _auditors(AUDITOR_B));
        (, bytes32 id) = att.verifyByReportHash("dup");
        assertEq(id, first);
    }

    function testFuzzCounterMatchesIds(uint8 n) public {
        n = uint8(bound(n, 1, 20));
        uint256 start = 1_700_000_000;
        for (uint256 i = 0; i < n; i++) {
            // Explicit timestamps: via_ir may cache block.timestamp across the loop.
            vm.warp(start + i);
            att.attestAudit("P", "h", "c", _auditors(AUDITOR_A));
        }
        assertEq(att.totalAttestations(), n);
        assertEq(att.getAllAttestationIds().length, n);
    }
}
