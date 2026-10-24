pragma solidity ^0.8.20;
contract UncheckedCallExample { function callTarget(address target) external { target.call(""); } }
