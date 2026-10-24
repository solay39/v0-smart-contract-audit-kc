pragma solidity ^0.8.20;
contract SafeOwner { address public immutable owner; constructor() { owner = msg.sender; } modifier onlyOwner() { require(msg.sender == owner); _; } function mint(address) external onlyOwner {} }
