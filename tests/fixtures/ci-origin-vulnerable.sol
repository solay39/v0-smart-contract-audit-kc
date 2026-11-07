// SPDX-License-Identifier: MIT
// SYNTHETIC REGRESSION FIXTURE. Do not deploy or use for funds.
pragma solidity 0.8.20;

contract ReliabilityFixture {
    address payable public owner;
    constructor() { owner = payable(msg.sender); }
    receive() external payable {}
    function withdraw() external {
        require(tx.origin == owner, "owner");
        owner.transfer(address(this).balance);
    }
}
