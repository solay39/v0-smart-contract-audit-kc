// SPDX-License-Identifier: MIT
// SYNTHETIC REGRESSION FIXTURE. Corrects only the authorization pattern.
// Not a general security certification or production recommendation.
pragma solidity 0.8.20;

contract ReliabilityFixture {
    address payable public owner;
    constructor() { owner = payable(msg.sender); }
    receive() external payable {}
    function withdraw() external {
        require(msg.sender == owner, "owner");
        owner.transfer(address(this).balance);
    }
}
