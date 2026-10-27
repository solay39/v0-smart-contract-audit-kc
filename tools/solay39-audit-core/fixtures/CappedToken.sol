// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
contract Capped {
    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public totalSupply;
    function mint(uint256 a) external {
        require(totalSupply + a <= MAX_SUPPLY, "cap");
        totalSupply += a;
    }
}
