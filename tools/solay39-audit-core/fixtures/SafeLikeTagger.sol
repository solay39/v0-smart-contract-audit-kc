// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

library Addr {
    function dcall(address t, bytes memory d) internal returns (bytes memory) {
        (bool ok, bytes memory r) = t.delegatecall(d); // presente ma MAI chiamata
        require(ok);
        return r;
    }
}

contract Token {
    uint256 public constant MAX_SUPPLY = 1000;   // dichiarata, mai usata
    uint256 public totalSupply;
    address public signer = address(0x1234);

    function claim(uint256 amount, bytes32 h, uint8 v, bytes32 r, bytes32 s) public {
        require(ecrecover(h, v, r, s) == signer, "bad sig");
        _mint(msg.sender, amount);
    }
    function addLiq(uint256 a) public {
        Params memory p = Params({amount0Min: 0, amount1Min: a});
        p;
    }
    struct Params { uint256 amount0Min; uint256 amount1Min; }
    function _mint(address, uint256 a) internal { totalSupply += a; }
}
