pragma solidity ^0.8.20;
contract TxOriginExample { address payable owner; function withdraw() external { require(tx.origin == owner); owner.transfer(address(this).balance); } }
