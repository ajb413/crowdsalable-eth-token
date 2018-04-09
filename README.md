# Crowdsalable Ethereum Token

Launch an ERC-20 Ethereum token with crowdsale capability using the Truffle development kit.

**Step-by-step tutorial for building this is available on the PubNub Blog, click here:**

[![pubnub blog](https://i.imgur.com/VHbsEnd.png)](https://www.pubnub.com/blog/how-to-launch-your-own-crowdsalable-cryptocurrency-part-3/?devrel_gh=erc20-ethereum-token)

Based on:
- [ERC-20](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md)
- [Truffle](http://truffleframework.com/docs/)
- [OpenZepplin](https://openzeppelin.org/)
- [Web3.js](https://github.com/ethereum/web3.js/)

## Quick Start
```
git clone git@github.com:ajb413/crowdsalable-eth-token.git
cd crowdsalable-eth-token
npm i
truffle develop

## Truffle development blockchain and console are booted
truffle(develop)> compile
truffle(develop)> migrate
truffle(develop)> test
```

In a second command line window, navigate to the project directory.
```
npm run dev
Project is running at http://localhost:8080/
```

Go to http://localhost:8080/ in a web browser and use the sample UI to check wallet balances and send sample tokens to wallets within your local machine's test network.

## Quick Start Explained

First, the repository was pulled from GitHub to your local machine. Next, all of the npm packages in `package.json` were installed on your machine. Make sure you have Node.js 5.0 or later.

Next we used the Truffle CLI to launch the Truffle development environment. That includes a `testrpc` instance. [Test RPC](https://github.com/trufflesuite/ganache-cli) is an instance of the Ethereum network that runs on your local machine. It starts with 10 random wallet key pairs that each have sufficient test ether. The instance that is started in the Truffle development console has the same 10 wallet addresses every time, which makes integration tests easier to write. Truffle develop hosts the instance at http://127.0.0.1:9545 by default.

Next we compiled our [Solidity](http://solidity.readthedocs.io/en/develop/) code into ABI objects. Then we migrated, which means we deployed our smart contracts to the development blockchain. The contract we deployed is the crowdsalable token.

When deployed, the entire balance of the tokens are issued to the first wallet in the list of 10 that Truffle boots with. This list can be found in `test/truffle-keys.js`. To edit the token properties like name, number, and symbol, check out the constructor in `contracts/Token.sol`.

```
function Token() public {
    symbol = 'TOK';
    name = 'Token';
    decimals = 18;
    totalSupply = 1000000000 * 10**uint(decimals);
    balances[msg.sender] = totalSupply;
    Transfer(address(0), msg.sender, totalSupply);
}
```

Next we ran the JavaScript and Solidity tests, which are explained below.

Next we opened another command line window, navigated to the project directory, and booted the test UI.

The test UI can be accessed in a web browser. The test UI uses Web3.js, a JavaScript framework that communicates requests made from a web or node.js application to the Ethereum network. In this case, the `Web3.providers.HttpProvider` is your local machine.

Requests can be made to the development blockchain to get balances of wallets and transfer token. The way Ethereum works is that you must spend ether if you are doing a blockchain altering operation, like transferring token. Reading data that is already written to the blockchain is free. So the `transfer` method costs some ether, and the `balanceOf` method is always free.

An unrealistic circumstance of the test instance is that you can `transfer` to and from any wallet. On the real network this does not work because each `transfer` request must be signed by a user's private key in order to succeed.

## Testing
If you are familiar with Javascript testing and Mocha, you will hit the ground running with [Truffle tests](http://truffleframework.com/docs/getting_started/testing). The Truffle development kit allows a developer to use [Javascript](http://truffleframework.com/docs/getting_started/javascript-tests) or [Solidity](http://truffleframework.com/docs/getting_started/solidity-tests) to run tests on your contracts.

My tests demonstrate using both, but mostly JavaScript, because it is easier to define different senders using the development key pairs.

The file `test/integration.test.js` demonstrates many scenarios for the Token methods and the crowdsale methods. There are examples for `.call()` and `web3.eth.sendRawTransaction()` using Web3.js. The raw transactions are very useful for sending a signed request from any wallet in which the user has the private and public key.

The integration test file imports the sample key pairs booted by `truffle develop` from `test/truffle-keys.js`. Note that `truffle develop` has these keys hard coded somewhere in the npm package, not in this repo's test folder.

The tests are run in the truffle console using just `test`, or from the command line using `truffle test` with an instance of `truffle develop` already running.

## Deploying

Truffle can be used to deploy to any Ethereum network. There are several public test networks and of course the Main Ethereum Network. In the `truffle.js` config file, we can define connections to any network, and use them to deploy our contract using the Truffle CLI.

The example uses an Ethereum wallet which has its unique mnemonic stored in the machine's environment variables as `ethereum_mnemonic`. The `ropsten` connection will deploy our contracts to the [Ropsten Test Network](https://ropsten.etherscan.io/) using a specified wallet. The Ropsten test network is consistently mined and test ether can be issued to your wallet instantly from a faucet.

```javascript
const mnemonic = process.env.ethereum_mnemonic;
const HDWalletProvider = require("truffle-hdwallet-provider");

require('babel-register');
require('babel-polyfill');

module.exports = {
  build: "npm run dev",
  networks: {
    development: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*" // Match any network id
    },
    ropsten: {
      provider: new HDWalletProvider(mnemonic, "https://ropsten.infura.io/"),
      network_id: 3
    }
  }
};
```

**Deploying to the Main Ethereum Network is costly and should only be done after you have extensively tested your contracts on test networks.**

To deploy to Ropsten we can use the following command. Keep in mind that deploying costs ether on the network you are deploying to.
```
truffle migrate --network ropsten
```
You can easily write a connection to the main network in your config using the Ropsten example and the [Truffle docs](http://truffleframework.com/docs/advanced/configuration).
