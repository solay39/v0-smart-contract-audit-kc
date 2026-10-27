// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IMgr { function createAndInitializePoolIfNecessary(address a, address b, uint24 f, uint160 p) external returns (address); }

contract Base {
    address public owner = msg.sender;
    mapping(address => bool) public isOp;
    modifier onlyOp() { require(isOp[msg.sender] || owner == msg.sender, "no"); _; }
    function _checkRole(address a) internal view virtual { require(isOp[a] || owner == a, "no"); }
    function grant(address a) external { _checkRole(msg.sender); isOp[a] = true; }
}

contract Sem is Base {
    uint256 public constant MAX_SUPPLY = 400;
    uint256 public constant RESERVE = 300;
    address public constant TREASURY = address(0xBEEF);
    uint256 public totalSupply;
    address private _signer;
    struct P { uint256 amount0Min; }

    function launch(address mgr) external onlyOp {
        _mint(TREASURY, RESERVE);
        IMgr(mgr).createAndInitializePoolIfNecessary(address(1), address(2), 500, 1);
        P memory p = P({amount0Min: 0});
        p;
    }
    function setSigner(address s) external onlyOp { _signer = s; }
    function claim(uint256 a, bytes32 h, uint8 v, bytes32 r, bytes32 s) external {
        require(ecrecover(h, v, r, s) == _signer, "sig");
        _mint(msg.sender, a);
    }
    function withdraw(address payable to, uint256 amt) external onlyOp { to.transfer(amt); }
    receive() external payable {}
    function _mint(address, uint256 a) internal { totalSupply += a; }
}
