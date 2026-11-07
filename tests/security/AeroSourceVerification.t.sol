// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// Trusted harness for one SHA-256-pinned public source snapshot.
// No fork, RPC, FFI, production transactions or claim about the wider protocol.
import {Aero} from "../src/Aero.sol";

interface VerificationVm {
    function prank(address sender) external;
    function assume(bool condition) external;
}

contract AeroSourceVerificationTest {
    VerificationVm constant vm = VerificationVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Aero token;
    address constant ALICE = address(0x1001);
    address constant BOB = address(0x1002);
    address constant SPENDER = address(0x1003);
    bytes4 constant NOT_MINTER = bytes4(keccak256("NotMinter()"));

    function setUp() public {
        token = new Aero();
    }

    function testFuzz_MintAccounting(uint128 amount) public {
        require(token.mint(ALICE, amount), "mint returned false");
        require(token.totalSupply() == amount, "mint supply mismatch");
        require(token.balanceOf(ALICE) == amount, "mint balance mismatch");
    }

    function testFuzz_TransferConservesSupply(uint128 minted, uint128 sample) public {
        token.mint(ALICE, minted);
        uint256 amount = uint256(sample) % (uint256(minted) + 1);
        vm.prank(ALICE);
        require(token.transfer(BOB, amount), "transfer returned false");
        require(token.balanceOf(ALICE) == uint256(minted) - amount, "sender balance mismatch");
        require(token.balanceOf(BOB) == amount, "recipient balance mismatch");
        require(token.totalSupply() == minted, "transfer changed supply");
    }

    function testFuzz_AllowanceConsumption(uint128 minted, uint128 sample) public {
        token.mint(ALICE, minted);
        uint256 amount = uint256(sample) % (uint256(minted) + 1);
        vm.prank(ALICE);
        token.approve(SPENDER, uint256(minted) + 7);
        vm.prank(SPENDER);
        require(token.transferFrom(ALICE, BOB, amount), "transferFrom returned false");
        require(token.allowance(ALICE, SPENDER) == uint256(minted) + 7 - amount, "allowance not consumed");
        require(token.balanceOf(ALICE) == uint256(minted) - amount, "delegated sender balance");
        require(token.balanceOf(BOB) == amount, "delegated recipient balance");
        require(token.totalSupply() == minted, "delegated transfer changed supply");
    }

    function testFuzz_MaxAllowanceUnchanged(uint128 amount) public {
        token.mint(ALICE, amount);
        vm.prank(ALICE);
        token.approve(SPENDER, type(uint256).max);
        vm.prank(SPENDER);
        require(token.transferFrom(ALICE, BOB, amount), "max-allowance transfer failed");
        require(token.allowance(ALICE, SPENDER) == type(uint256).max, "max allowance changed");
        require(token.balanceOf(BOB) == amount, "max-allowance recipient balance");
    }

    function testFuzz_RejectInsufficientAllowance(uint128 amount) public {
        token.mint(ALICE, uint256(amount) + 1);
        vm.prank(ALICE);
        token.approve(SPENDER, amount);
        vm.prank(SPENDER);
        (bool ok,) = address(token)
            .call(abi.encodeWithSignature("transferFrom(address,address,uint256)", ALICE, BOB, uint256(amount) + 1));
        require(!ok, "insufficient allowance accepted");
        require(token.balanceOf(ALICE) == uint256(amount) + 1, "revert changed balance");
        require(token.balanceOf(BOB) == 0, "revert credited recipient");
        require(token.allowance(ALICE, SPENDER) == amount, "revert changed allowance");
        require(token.totalSupply() == uint256(amount) + 1, "revert changed supply");
    }

    function testFuzz_RejectOverdraft(uint128 amount) public {
        token.mint(ALICE, amount);
        vm.prank(ALICE);
        (bool ok,) = address(token).call(abi.encodeWithSignature("transfer(address,uint256)", BOB, uint256(amount) + 1));
        require(!ok, "overdraft accepted");
        require(token.balanceOf(ALICE) == amount && token.balanceOf(BOB) == 0, "overdraft changed balances");
        require(token.totalSupply() == amount, "overdraft changed supply");
    }

    function testFuzz_UnauthorizedMint(address actor, uint256 amount) public {
        vm.assume(actor != address(this));
        vm.prank(actor);
        (bool ok, bytes memory reason) =
            address(token).call(abi.encodeWithSignature("mint(address,uint256)", ALICE, amount));
        require(!ok, "unauthorized mint succeeded");
        require(reason.length == 4 && bytes4(reason) == NOT_MINTER, "wrong mint rejection");
        require(token.totalSupply() == 0 && token.balanceOf(ALICE) == 0, "rejected mint changed state");
    }

    function testFuzz_MinterRotation(address next, uint128 amount) public {
        vm.assume(next != address(0) && next != address(this));
        token.setMinter(next);
        (bool ok, bytes memory reason) =
            address(token).call(abi.encodeWithSignature("mint(address,uint256)", ALICE, amount));
        require(!ok && reason.length == 4 && bytes4(reason) == NOT_MINTER, "old minter retained authority");
        vm.prank(next);
        require(token.mint(ALICE, amount), "new minter cannot mint");
        require(token.balanceOf(ALICE) == amount && token.totalSupply() == amount, "rotated mint accounting");
        require(token.minter() == next, "wrong minter stored");
    }

    function test_UnauthorizedMinterRotation() public {
        vm.prank(ALICE);
        (bool ok, bytes memory reason) = address(token).call(abi.encodeWithSignature("setMinter(address)", BOB));
        require(!ok && reason.length == 4 && bytes4(reason) == NOT_MINTER, "unauthorized rotation accepted");
        require(token.minter() == address(this), "unauthorized rotation changed minter");
    }

    function test_ZeroAddressOperationsRevert() public {
        token.mint(ALICE, 10);
        (bool mintOk,) = address(token).call(abi.encodeWithSignature("mint(address,uint256)", address(0), 1));
        vm.prank(ALICE);
        (bool transferOk,) = address(token).call(abi.encodeWithSignature("transfer(address,uint256)", address(0), 1));
        vm.prank(ALICE);
        (bool approveOk,) = address(token).call(abi.encodeWithSignature("approve(address,uint256)", address(0), 1));
        require(!mintOk && !transferOk && !approveOk, "zero-address operation accepted");
        require(token.totalSupply() == 10 && token.balanceOf(ALICE) == 10, "zero-address rejection changed state");
    }
}

// A small, explicit actor model. It does not cover all possible call sequences.
contract AeroVerificationHandler {
    VerificationVm constant vm = VerificationVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Aero public immutable token;
    address[4] public actors = [address(0x1001), address(0x1002), address(0x1003), address(0x1004)];
    mapping(address => uint256) public expectedBalance;
    uint256 public expectedSupply;

    constructor(Aero token_) {
        token = token_;
    }

    function mint(uint8 who, uint96 sample) external {
        address actor = actors[who % 4];
        uint256 amount = uint256(sample) % 1e24;
        require(token.mint(actor, amount), "stateful mint failed");
        expectedBalance[actor] += amount;
        expectedSupply += amount;
    }

    function transfer(uint8 fromSeed, uint8 toSeed, uint96 sample) external {
        address from = actors[fromSeed % 4];
        address to = actors[toSeed % 4];
        uint256 amount = uint256(sample) % (expectedBalance[from] + 1);
        vm.prank(from);
        require(token.transfer(to, amount), "stateful transfer failed");
        expectedBalance[from] -= amount;
        expectedBalance[to] += amount;
    }

    function approveAndSpend(uint8 fromSeed, uint8 toSeed, uint96 sample) external {
        address from = actors[fromSeed % 4];
        address to = actors[toSeed % 4];
        address spender = actors[(uint256(fromSeed) % 4 + 1) % 4];
        uint256 amount = uint256(sample) % (expectedBalance[from] + 1);
        vm.prank(from);
        require(token.approve(spender, amount + 7), "stateful approve failed");
        vm.prank(spender);
        require(token.transferFrom(from, to, amount), "stateful transferFrom failed");
        require(token.allowance(from, spender) == 7, "stateful allowance mismatch");
        expectedBalance[from] -= amount;
        expectedBalance[to] += amount;
    }

    function unauthorizedMint(uint8 who, uint96 amount) external {
        vm.prank(actors[who % 4]);
        (bool ok, bytes memory reason) =
            address(token).call(abi.encodeWithSignature("mint(address,uint256)", actors[0], amount));
        require(
            !ok && reason.length == 4 && bytes4(reason) == bytes4(keccak256("NotMinter()")),
            "stateful unauthorized mint"
        );
    }
}

contract AeroSourceInvariantTest {
    struct FuzzSelector {
        address addr;
        bytes4[] selectors;
    }
    Aero token;
    AeroVerificationHandler handler;

    function setUp() public {
        token = new Aero();
        handler = new AeroVerificationHandler(token);
        token.setMinter(address(handler));
    }

    function targetContracts() external view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function targetSelectors() external view returns (FuzzSelector[] memory targets) {
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.mint.selector;
        selectors[1] = handler.transfer.selector;
        selectors[2] = handler.approveAndSpend.selector;
        selectors[3] = handler.unauthorizedMint.selector;
        targets = new FuzzSelector[](1);
        targets[0] = FuzzSelector(address(handler), selectors);
    }

    function invariant_SupplyAndBalancesMatchModel() public view {
        uint256 sum;
        for (uint256 i; i < 4; ++i) {
            address actor = handler.actors(i);
            require(token.balanceOf(actor) == handler.expectedBalance(actor), "stateful balance mismatch");
            sum += token.balanceOf(actor);
        }
        require(sum == token.totalSupply(), "stateful conservation failure");
        require(token.totalSupply() == handler.expectedSupply(), "stateful supply mismatch");
    }

    function invariant_MinterRemainsHandler() public view {
        require(token.minter() == address(handler), "stateful minter changed");
    }
}
