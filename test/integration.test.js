const EthereumTx = require('ethereumjs-tx');
const privateKeys = require('./truffle-keys').private;
const publicKeys = require('./truffle-keys').public;
const Token = artifacts.require('./Token.sol');

contract('Token (integration)', function(accounts) {
  let contract;
  let owner;
  let web3Contract;

  before(async () => {
    contract = await Token.deployed();
    web3Contract = web3.eth.contract(contract.abi).at(contract.address);
    owner = web3Contract._eth.coinbase;
    let other = web3.eth.accounts[1];

    if (publicKeys[0] !== owner || publicKeys[1] !== other) {
      throw new Error('Use `truffle develop` and /test/truffle-keys.js');
    }

  });

  it('should pass if contract is deployed', async function() {
    let name = await contract.name.call();
    assert.strictEqual(name, 'Token');
  });

  it('should return inital token wei balance of 1*10^27', async function() {
    let ownerBalance = await contract.balanceOf.call(owner);
    ownerBalance = ownerBalance.toString();
    assert.strictEqual(ownerBalance, '1e+27');
  });

  it('should properly [transfer] token', async function() {
    let recipient = web3.eth.accounts[1];
    let tokenWei = 1000000;

    await contract.transfer(recipient, tokenWei);
    
    let ownerBalance = await contract.balanceOf.call(owner);
    let recipientBalance = await contract.balanceOf.call(recipient);

    assert.strictEqual(ownerBalance.toString(), '9.99999999999999999999e+26');
    assert.strictEqual(recipientBalance.toNumber(), tokenWei);
  });

  it('should properly return the [totalSupply] of tokens', async function() {
    let totalSupply = await contract.totalSupply.call();
    totalSupply = totalSupply.toString();
    assert.strictEqual(totalSupply, '1e+27');
  });

  it('should [approve] token for [transferFrom]', async function() {
    let approver = owner;
    let spender = web3.eth.accounts[2];

    let originalAllowance = await contract.allowance.call(approver, spender);

    let tokenWei = 5000000;
    await contract.approve(spender, tokenWei);

    let resultAllowance = await contract.allowance.call(approver, spender);

    assert.strictEqual(originalAllowance.toNumber(), 0);
    assert.strictEqual(resultAllowance.toNumber(), tokenWei);
  });

  it('should fail to [transferFrom] more than allowed', async function() {
    let from = owner;
    let to = web3.eth.accounts[2];
    let spenderPrivateKey = privateKeys[2];
    let tokenWei = 10000000;

    let allowance = await contract.allowance.call(from, to);
    let ownerBalance = await contract.balanceOf.call(from);
    let spenderBalance = await contract.balanceOf.call(to);

    let data = web3Contract.transferFrom.getData(from, to, tokenWei);

    let errorMessage;
    try {
      await rawTransaction(
        to,
        spenderPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    assert.strictEqual(
      errorMessage,
      'VM Exception while processing transaction: invalid opcode'
    );
  });

  it('should [transferFrom] approved tokens', async function() {
    let from = owner;
    let to = web3.eth.accounts[2];
    let spenderPrivateKey = privateKeys[2];
    let tokenWei = 5000000;

    let allowance = await contract.allowance.call(from, to);
    let ownerBalance = await contract.balanceOf.call(from);
    let spenderBalance = await contract.balanceOf.call(to);

    let data = web3Contract.transferFrom.getData(from, to, tokenWei);

    let result = await rawTransaction(
      to,
      spenderPrivateKey,
      contract.address,
      data,
      0
    );

    let allowanceAfter = await contract.allowance.call(from, to);
    let ownerBalanceAfter = await contract.balanceOf.call(from);
    let spenderBalanceAfter = await contract.balanceOf.call(to);

    // Correct account balances
    // toString() numbers that are too large for js
    assert.strictEqual(
      ownerBalance.toString(),
      ownerBalanceAfter.add(tokenWei).toString()
    );
    assert.strictEqual(
      spenderBalance.add(tokenWei).toString(),
      spenderBalanceAfter.toString()
    );

    // Proper original allowance
    assert.strictEqual(allowance.toNumber(), tokenWei);

    // All of the allowance should have been used
    assert.strictEqual(allowanceAfter.toNumber(), 0);

    // Normal transaction hash, not an error.
    assert.strictEqual(0, result.indexOf('0x'));
  });

});

/*
 * Call a smart contract function from any keyset in which the caller has the
 *     private and public keys.
 * @param {string} senderPublicKey Public key in key pair.
 * @param {string} senderPrivateKey Private key in key pair.
 * @param {string} contractAddress Address of Solidity contract.
 * @param {string} data Data from the function's `getData` in web3.js.
 * @param {number} value Number of Ethereum wei sent in the transaction.
 * @return {Promise}
 */
function rawTransaction(
  senderPublicKey,
  senderPrivateKey,
  contractAddress,
  data,
  value
) {
  return new Promise((resolve, reject) => {

    let key = new Buffer(senderPrivateKey, 'hex');
    let nonce = web3.toHex(web3.eth.getTransactionCount(senderPublicKey));

    let gasPrice = web3.eth.gasPrice;
    let gasPriceHex = web3.toHex(web3.eth.estimateGas({
      from: contractAddress
    }));
    let gasLimitHex = web3.toHex(5500000);

    let rawTx = {
        nonce: nonce,
        gasPrice: gasPriceHex,
        gasLimit: gasLimitHex,
        data: data,
        to: contractAddress,
        value: web3.toHex(value)
    };

    let tx = new EthereumTx(rawTx);
    tx.sign(key);

    let stx = '0x' + tx.serialize().toString('hex');

    web3.eth.sendRawTransaction(stx, (err, hash) => {
      if (err) {
        reject(err);
      } else {
        resolve(hash);
      }
    });

  });
}
