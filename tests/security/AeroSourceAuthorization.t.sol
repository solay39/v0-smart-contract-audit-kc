// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// Source-level benchmark only. The imported snapshot remains GPL-3.0-or-later.
// No RPC, fork, deployment-state claim or FFI.
import {Aero} from "../src/Aero.sol";

interface BenchmarkVm {
    function prank(address sender) external;
    function assume(bool condition) external;
}

contract AeroSourceAuthorizationTest {
    BenchmarkVm constant vm = BenchmarkVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Aero token;
    bytes4 constant NOT_MINTER = bytes4(keccak256("NotMinter()"));

    function setUp() public { token = new Aero(); }

    function assertUnauthorizedMint(address actor, uint256 amount) internal {
        uint256 beforeSupply = token.totalSupply();
        vm.prank(actor);
        (bool ok, bytes memory reason) = address(token).call(abi.encodeWithSignature("mint(address,uint256)", actor, amount));
        require(!ok, "unauthorized mint succeeded");
        require(reason.length >= 4 && bytes4(reason) == NOT_MINTER, "unexpected revert");
        require(token.totalSupply() == beforeSupply, "supply changed");
    }

    function test_UnauthorizedMintReverts() public { assertUnauthorizedMint(address(0xBEEF), 1 ether); }

    function test_AuthorizedMintChangesSupply() public {
        uint256 beforeSupply = token.totalSupply();
        require(token.mint(address(0xBEEF), 1 ether), "authorized mint failed");
        require(token.totalSupply() == beforeSupply + 1 ether, "supply delta");
        require(token.balanceOf(address(0xBEEF)) == 1 ether, "balance delta");
    }

    function test_UnauthorizedSetMinterReverts() public {
        vm.prank(address(0xBEEF));
        (bool ok, bytes memory reason) = address(token).call(abi.encodeWithSignature("setMinter(address)", address(0xCAFE)));
        require(!ok && reason.length >= 4 && bytes4(reason) == NOT_MINTER, "setMinter authorization");
        require(token.minter() == address(this), "minter changed");
    }

    function test_DelegatedMinterOnly() public {
        token.setMinter(address(0xBEEF));
        assertUnauthorizedMint(address(this), 1 ether);
        vm.prank(address(0xBEEF));
        require(token.mint(address(0xCAFE), 1 ether), "new minter cannot mint");
        require(token.balanceOf(address(0xCAFE)) == 1 ether, "balance delta");
    }

    // A passing observation confirms behavior, not that the behavior is secure.
    function test_Observation_SetMinterAcceptsZero() public {
        token.setMinter(address(0));
        require(token.minter() == address(0), "zero minter not stored");
        assertUnauthorizedMint(address(this), 1 ether);
    }

    function test_Observation_AuthorizedLargeMintSample() public {
        require(token.mint(address(0xBEEF), 10 ** 36), "large sample rejected");
        require(token.totalSupply() == 10 ** 36, "sample supply");
    }

    function test_Observation_DelegationCanRepeat() public {
        token.setMinter(address(0xBEEF));
        vm.prank(address(0xBEEF));
        token.setMinter(address(0xCAFE));
        require(token.minter() == address(0xCAFE), "second delegation failed");
    }

    function testFuzz_UnauthorizedMintReverts(address actor, uint256 amount) public {
        vm.assume(actor != address(this));
        assertUnauthorizedMint(actor, amount);
    }
}
