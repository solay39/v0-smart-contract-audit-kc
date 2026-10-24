pragma solidity ^0.8.20;
contract AccessControlExample { address public owner; function mint(address to) external { _mint(to); } function _mint(address) internal {} }
