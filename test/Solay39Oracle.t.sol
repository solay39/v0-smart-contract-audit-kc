// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../contracts/Solay39Oracle.sol";

contract Solay39OracleTest is Test {
    Solay39Oracle internal oracle;

    uint256 internal constant SIGNER_PK = 0xA11CE;
    address internal signer;
    address internal constant TARGET = address(0x1234);
    address internal constant STRANGER = address(0xBEEF);

    event AuditPublished(
        address indexed contractAddress,
        uint8 score,
        string rating,
        string reportHash,
        uint256 timestamp
    );
    event AuditRevoked(address indexed contractAddress, string reason);
    event AuditUpdated(address indexed contractAddress, uint8 newScore, string newRating);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        oracle = new Solay39Oracle(signer);
    }

    function _publish(address target, uint8 score, uint256 criticals, uint256 validityDays) internal {
        vm.prank(signer);
        oracle.publishAudit(target, score, "AA", criticals, 1, 2, 3, "sha256:r", "ipfs://r", validityDays);
    }

    // --- Constructor & signer admin ---

    function testConstructorAuthorizesInitialSignerAndOwner() public view {
        assertEq(oracle.owner(), address(this));
        assertTrue(oracle.authorizedSigners(signer));
        assertTrue(oracle.authorizedSigners(address(this)));
    }

    function testOwnerCanAddAndRemoveSigner() public {
        vm.expectEmit(true, false, false, false, address(oracle));
        emit SignerAdded(STRANGER);
        oracle.addSigner(STRANGER);
        assertTrue(oracle.authorizedSigners(STRANGER));

        vm.expectEmit(true, false, false, false, address(oracle));
        emit SignerRemoved(STRANGER);
        oracle.removeSigner(STRANGER);
        assertFalse(oracle.authorizedSigners(STRANGER));
    }

    function testAddZeroSignerReverts() public {
        vm.expectRevert(bytes("Invalid signer"));
        oracle.addSigner(address(0));
    }

    function testNonOwnerCannotManageSigners() public {
        vm.startPrank(signer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, signer));
        oracle.addSigner(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, signer));
        oracle.removeSigner(address(this));
        vm.stopPrank();
    }

    function testRemovedSignerLosesAccess() public {
        oracle.removeSigner(signer);
        vm.prank(signer);
        vm.expectRevert(bytes("Not authorized signer"));
        oracle.publishAudit(TARGET, 90, "AA", 0, 0, 0, 0, "h", "u", 0);
    }

    // --- publishAudit ---

    function testUnauthorizedCannotPublish() public {
        vm.prank(STRANGER);
        vm.expectRevert(bytes("Not authorized signer"));
        oracle.publishAudit(TARGET, 90, "AA", 0, 0, 0, 0, "h", "u", 0);
    }

    function testPublishValidations() public {
        vm.startPrank(signer);
        vm.expectRevert(bytes("Invalid contract address"));
        oracle.publishAudit(address(0), 90, "AA", 0, 0, 0, 0, "h", "u", 0);

        vm.expectRevert(bytes("Score must be 0-100"));
        oracle.publishAudit(TARGET, 101, "AA", 0, 0, 0, 0, "h", "u", 0);

        vm.expectRevert(bytes("Report hash required"));
        oracle.publishAudit(TARGET, 90, "AA", 0, 0, 0, 0, "", "u", 0);
        vm.stopPrank();
    }

    function testPublishStoresRecordAndEmits() public {
        vm.warp(1_700_000_000);
        vm.expectEmit(true, false, false, true, address(oracle));
        emit AuditPublished(TARGET, 88, "AA", "sha256:r", 1_700_000_000);
        _publish(TARGET, 88, 0, 30);

        Solay39Oracle.AuditRecord memory r = oracle.getAudit(TARGET);
        assertEq(r.contractAddress, TARGET);
        assertEq(r.score, 88);
        assertEq(r.rating, "AA");
        assertEq(r.criticals, 0);
        assertEq(r.highs, 1);
        assertEq(r.mediums, 2);
        assertEq(r.lows, 3);
        assertEq(r.reportHash, "sha256:r");
        assertEq(r.reportUrl, "ipfs://r");
        assertEq(r.timestamp, 1_700_000_000);
        assertEq(r.expiresAt, 1_700_000_000 + 30 days);
        assertTrue(r.isActive);

        assertTrue(oracle.hasAudit(TARGET));
        assertEq(oracle.totalAudits(), 1);
        assertEq(oracle.getAuditCount(), 1);
        assertEq(oracle.getAllAuditedContracts()[0], TARGET);
    }

    function testZeroValidityNeverExpires() public {
        _publish(TARGET, 90, 0, 0);
        assertEq(oracle.getAudit(TARGET).expiresAt, 0);
        vm.warp(block.timestamp + 3650 days);
        (, bool valid) = oracle.getScore(TARGET);
        assertTrue(valid);
    }

    function testRepublishDoesNotDuplicateEnumeration() public {
        _publish(TARGET, 70, 1, 0);
        _publish(TARGET, 95, 0, 0);
        assertEq(oracle.totalAudits(), 1);
        assertEq(oracle.getAuditCount(), 1);
        assertEq(oracle.getAudit(TARGET).score, 95);
    }

    /// @dev Documents current behaviour: global counters accumulate on every
    ///      republish, so they reflect published findings, not live findings.
    function testRepublishAccumulatesGlobalCounters() public {
        _publish(TARGET, 70, 2, 0);
        _publish(TARGET, 70, 2, 0);
        assertEq(oracle.totalCriticals(), 4);
        assertEq(oracle.totalHighs(), 2);
    }

    function testRepublishReactivatesRevokedAudit() public {
        _publish(TARGET, 90, 0, 0);
        vm.prank(signer);
        oracle.revokeAudit(TARGET, "exploit");
        _publish(TARGET, 90, 0, 0);
        assertTrue(oracle.getAudit(TARGET).isActive);
    }

    function testFuzzPublishScoreBounds(uint8 score) public {
        vm.prank(signer);
        if (score > 100) {
            vm.expectRevert(bytes("Score must be 0-100"));
            oracle.publishAudit(TARGET, score, "X", 0, 0, 0, 0, "h", "u", 0);
        } else {
            oracle.publishAudit(TARGET, score, "X", 0, 0, 0, 0, "h", "u", 0);
            (uint8 s, ) = oracle.getScore(TARGET);
            assertEq(s, score);
        }
    }

    // --- Score breakdown ---

    function testBreakdownRequiresAudit() public {
        vm.prank(signer);
        vm.expectRevert(bytes("No audit exists"));
        oracle.publishScoreBreakdown(TARGET, 1, 2, 3, 4, 5, 6);
    }

    function testBreakdownStored() public {
        _publish(TARGET, 90, 0, 0);
        vm.prank(signer);
        oracle.publishScoreBreakdown(TARGET, 10, 20, 30, 40, 50, 60);
        Solay39Oracle.ScoreBreakdown memory b = oracle.getScoreBreakdown(TARGET);
        assertEq(b.codeSecurity, 10);
        assertEq(b.architectureRisk, 20);
        assertEq(b.centralization, 30);
        assertEq(b.governanceRisk, 40);
        assertEq(b.testingCoverage, 50);
        assertEq(b.externalRisk, 60);
    }

    function testUnauthorizedCannotPublishBreakdown() public {
        _publish(TARGET, 90, 0, 0);
        vm.prank(STRANGER);
        vm.expectRevert(bytes("Not authorized signer"));
        oracle.publishScoreBreakdown(TARGET, 1, 2, 3, 4, 5, 6);
    }

    // --- Revoke ---

    function testRevokeInvalidatesScore() public {
        _publish(TARGET, 90, 0, 0);
        vm.expectEmit(true, false, false, true, address(oracle));
        emit AuditRevoked(TARGET, "exploit found");
        vm.prank(signer);
        oracle.revokeAudit(TARGET, "exploit found");

        (uint8 score, bool valid) = oracle.getScore(TARGET);
        assertEq(score, 90);
        assertFalse(valid);
        assertFalse(oracle.meetsRequirements(TARGET, 0, type(uint256).max));
    }

    function testRevokeRequiresAudit() public {
        vm.prank(signer);
        vm.expectRevert(bytes("No audit exists"));
        oracle.revokeAudit(TARGET, "x");
    }

    function testUnauthorizedCannotRevoke() public {
        _publish(TARGET, 90, 0, 0);
        vm.prank(STRANGER);
        vm.expectRevert(bytes("Not authorized signer"));
        oracle.revokeAudit(TARGET, "x");
    }

    // --- Update ---

    function testUpdateChangesScoreAndReactivates() public {
        _publish(TARGET, 60, 3, 0);
        vm.prank(signer);
        oracle.revokeAudit(TARGET, "x");

        vm.warp(block.timestamp + 1 days);
        vm.expectEmit(true, false, false, true, address(oracle));
        emit AuditUpdated(TARGET, 92, "AAA");
        vm.prank(signer);
        oracle.updateAudit(TARGET, 92, "AAA", 0, 0, 1, 1);

        Solay39Oracle.AuditRecord memory r = oracle.getAudit(TARGET);
        assertEq(r.score, 92);
        assertEq(r.rating, "AAA");
        assertEq(r.criticals, 0);
        assertEq(r.timestamp, block.timestamp);
        assertTrue(r.isActive);
        assertEq(r.reportHash, "sha256:r", "update keeps original report hash");
    }

    /// @dev Documents current behaviour: updateAudit skips the 0-100 bound
    ///      enforced by publishAudit.
    function testUpdateDoesNotEnforceScoreBound() public {
        _publish(TARGET, 60, 0, 0);
        vm.prank(signer);
        oracle.updateAudit(TARGET, 255, "?", 0, 0, 0, 0);
        assertEq(oracle.getAudit(TARGET).score, 255);
    }

    /// @dev Documents current behaviour: updating does not extend expiry,
    ///      so an expired audit stays invalid after an update.
    function testUpdateDoesNotExtendExpiry() public {
        _publish(TARGET, 90, 0, 1);
        vm.warp(block.timestamp + 2 days);
        vm.prank(signer);
        oracle.updateAudit(TARGET, 95, "AAA", 0, 0, 0, 0);
        (, bool valid) = oracle.getScore(TARGET);
        assertFalse(valid);
    }

    function testUpdateRequiresAudit() public {
        vm.prank(signer);
        vm.expectRevert(bytes("No audit exists"));
        oracle.updateAudit(TARGET, 90, "AA", 0, 0, 0, 0);
    }

    // --- Views: getScore / meetsRequirements / verifyReportHash ---

    function testGetScoreUnknownContract() public view {
        (uint8 score, bool valid) = oracle.getScore(TARGET);
        assertEq(score, 0);
        assertFalse(valid);
    }

    function testExpiryBoundary() public {
        _publish(TARGET, 90, 0, 1);
        uint256 expiresAt = oracle.getAudit(TARGET).expiresAt;

        vm.warp(expiresAt);
        (, bool validAtExpiry) = oracle.getScore(TARGET);
        assertTrue(validAtExpiry);
        assertTrue(oracle.meetsRequirements(TARGET, 90, 0));

        vm.warp(expiresAt + 1);
        (, bool validAfter) = oracle.getScore(TARGET);
        assertFalse(validAfter);
        assertFalse(oracle.meetsRequirements(TARGET, 90, 0));
    }

    function testMeetsRequirementsThresholds() public {
        _publish(TARGET, 75, 1, 0);
        assertFalse(oracle.meetsRequirements(address(0xDEAD), 0, 100));
        assertTrue(oracle.meetsRequirements(TARGET, 75, 1));
        assertFalse(oracle.meetsRequirements(TARGET, 76, 1));
        assertFalse(oracle.meetsRequirements(TARGET, 75, 0));
    }

    function testFuzzMeetsRequirements(uint8 score, uint8 minScore, uint256 crit, uint256 maxCrit) public {
        score = uint8(bound(score, 0, 100));
        crit = bound(crit, 0, 1_000);
        maxCrit = bound(maxCrit, 0, 1_000);
        _publish(TARGET, score, crit, 0);
        assertEq(oracle.meetsRequirements(TARGET, minScore, maxCrit), score >= minScore && crit <= maxCrit);
    }

    function testVerifyReportHash() public {
        assertFalse(oracle.verifyReportHash(TARGET, "sha256:r"));
        _publish(TARGET, 90, 0, 0);
        assertTrue(oracle.verifyReportHash(TARGET, "sha256:r"));
        assertFalse(oracle.verifyReportHash(TARGET, "sha256:other"));
    }

    // --- Signed off-chain scores ---

    function _sign(uint256 pk, address target, uint8 score, uint256 ts) internal pure returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked("SOLAY39_SCORE:", target, score, ts))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testVerifySignedScoreAuthorized() public view {
        bytes memory sig = _sign(SIGNER_PK, TARGET, 88, 1_700_000_000);
        (bool ok, address recovered) = oracle.verifySignedScore(TARGET, 88, 1_700_000_000, sig);
        assertTrue(ok);
        assertEq(recovered, signer);
    }

    function testVerifySignedScoreUnauthorizedSigner() public view {
        uint256 otherPk = 0xB0B;
        bytes memory sig = _sign(otherPk, TARGET, 88, 1);
        (bool ok, address recovered) = oracle.verifySignedScore(TARGET, 88, 1, sig);
        assertFalse(ok);
        assertEq(recovered, vm.addr(otherPk));
    }

    function testVerifySignedScoreTamperedScore() public view {
        bytes memory sig = _sign(SIGNER_PK, TARGET, 88, 1);
        (bool ok, address recovered) = oracle.verifySignedScore(TARGET, 99, 1, sig);
        assertFalse(ok);
        assertTrue(recovered != signer);
    }

    function testVerifySignedScoreAfterSignerRemoved() public {
        bytes memory sig = _sign(SIGNER_PK, TARGET, 88, 1);
        oracle.removeSigner(signer);
        (bool ok, ) = oracle.verifySignedScore(TARGET, 88, 1, sig);
        assertFalse(ok);
    }

    function testVerifySignedScoreMalformedSignatureReverts() public {
        vm.expectRevert();
        oracle.verifySignedScore(TARGET, 88, 1, hex"1234");
    }
}

contract Solay39SecurityGateTest is Test {
    Solay39Oracle internal oracle;
    Solay39SecurityGate internal gate;
    address internal constant TARGET = address(0x1234);

    function setUp() public {
        oracle = new Solay39Oracle(address(this));
        gate = new Solay39SecurityGate(address(oracle), 70, 0);
    }

    function testGateConfig() public view {
        assertEq(address(gate.oracle()), address(oracle));
        assertEq(gate.minRequiredScore(), 70);
        assertEq(gate.maxAllowedCriticals(), 0);
    }

    function testGateBlocksUnaudited() public {
        assertFalse(gate.isSafe(TARGET));
        vm.expectRevert(bytes("Contract does not meet SOLAY39 security requirements"));
        gate.safeInteract(TARGET);
    }

    function testGateAllowsCompliantContract() public {
        oracle.publishAudit(TARGET, 80, "A", 0, 0, 0, 0, "h", "u", 0);
        assertTrue(gate.isSafe(TARGET));
        assertTrue(gate.safeInteract(TARGET));
    }

    function testGateBlocksLowScoreOrCriticals() public {
        oracle.publishAudit(TARGET, 69, "B", 0, 0, 0, 0, "h", "u", 0);
        assertFalse(gate.isSafe(TARGET));

        oracle.publishAudit(TARGET, 95, "AA", 1, 0, 0, 0, "h", "u", 0);
        assertFalse(gate.isSafe(TARGET));
    }

    function testGateBlocksAfterRevocation() public {
        oracle.publishAudit(TARGET, 95, "AA", 0, 0, 0, 0, "h", "u", 0);
        oracle.revokeAudit(TARGET, "exploit");
        assertFalse(gate.isSafe(TARGET));
    }
}
