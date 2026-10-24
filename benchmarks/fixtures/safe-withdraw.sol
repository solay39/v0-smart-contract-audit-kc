pragma solidity ^0.8.20;
contract SafeWithdraw { mapping(address => uint256) public balances; function withdraw() external { uint256 amount = balances[msg.sender]; balances[msg.sender] = 0; (bool ok,) = payable(msg.sender).call{value: amount}(""); require(ok); } }
