// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract Proxyish {
    address public impl;
    function setImpl(address a) external { impl = a; }          // nessun controllo di accesso
    fallback() external payable {
        (bool ok, ) = impl.delegatecall(msg.data);             // raggiungibile
        require(ok);
    }
}
