pragma solidity ^0.4.18;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/Token.sol";

contract TestToken {

    function testInitialBalanceUsingDeployedContract() public {
        Token tok = Token(DeployedAddresses.Token());

        // 1*10^27 wei
        uint expected = 1000000000000000000000000000;
        string memory details = 'Owner should have 1e+27 Token initially';

        Assert.equal(tok.balanceOf(tx.origin), expected, details);
    }

}
