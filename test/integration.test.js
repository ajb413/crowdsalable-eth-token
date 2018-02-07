const EthereumTx = require('ethereumjs-tx');
const privateKeys = require('./truffle-keys').private;
const publicKeys = require('./truffle-keys').public;
const Token = artifacts.require('./Token.sol');

contract('Token', function(accounts) {
  let contract;
  let owner;
  let web3Contract;
  let eventCounter = {};

  before(async () => {
    contract = await Token.deployed();
    web3Contract = web3.eth.contract(contract.abi).at(contract.address);
    owner = web3Contract._eth.coinbase;
    let other = publicKeys[1];

    if (publicKeys[0] !== owner || publicKeys[1] !== other) {
      throw new Error('Use `truffle develop` and /test/truffle-keys.js');
    }

    // Counts every event that solidity functions fire.
    // TODO: Confirm individual event contents in each test.
    contract.allEvents({}, (error, details) => {
      if (error) {
        console.error(error);
      } else {
        let count = eventCounter[details.event];
        eventCounter[details.event] = count ? count + 1 : 1;
      }
    });
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
    let recipient = publicKeys[1];
    let tokenWei = 1000000;

    await contract.transfer(recipient, tokenWei);
    
    let ownerBalance = await contract.balanceOf.call(owner);
    let recipientBalance = await contract.balanceOf.call(recipient);

    assert.strictEqual(ownerBalance.toString(), '9.99999999999999999999e+26');
    assert.strictEqual(recipientBalance.toNumber(), tokenWei);
  });

  it('should properly between non-owners [transfer] token', async function() {
    let sender = publicKeys[1];
    let senderPrivateKey = privateKeys[1];
    let recipient = publicKeys[2];
    let tokenWei = 500000;
    
    let data = web3Contract.transfer.getData(recipient, tokenWei);

    let result = await rawTransaction(
      sender,
      senderPrivateKey,
      contract.address,
      data,
      0
    );

    let senderBalance = await contract.balanceOf.call(sender);
    let recipientBalance = await contract.balanceOf.call(recipient);

    assert.strictEqual(senderBalance.toNumber(), tokenWei);
    assert.strictEqual(recipientBalance.toNumber(), tokenWei);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [transfer] token too much token', async function() {
    let sender = publicKeys[1];
    let senderPrivateKey = privateKeys[1];
    let recipient = publicKeys[2];
    let tokenWei = 50000000;
    
    let data = web3Contract.transfer.getData(recipient, tokenWei);

    let errorMessage;
    try {
      await rawTransaction(
        sender,
        senderPrivateKey,
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

    let senderBalance = await contract.balanceOf.call(sender);
    let recipientBalance = await contract.balanceOf.call(recipient);

    assert.strictEqual(senderBalance.toNumber(), 500000);
    assert.strictEqual(recipientBalance.toNumber(), 500000);
  });

  it('should properly return the [totalSupply] of tokens', async function() {
    let totalSupply = await contract.totalSupply.call();
    totalSupply = totalSupply.toString();
    assert.strictEqual(totalSupply, '1e+27');
  });

  it('should [approve] token for [transferFrom]', async function() {
    let approver = owner;
    let spender = publicKeys[2];

    let originalAllowance = await contract.allowance.call(approver, spender);

    let tokenWei = 5000000;
    await contract.approve(spender, tokenWei);

    let resultAllowance = await contract.allowance.call(approver, spender);

    assert.strictEqual(originalAllowance.toNumber(), 0);
    assert.strictEqual(resultAllowance.toNumber(), tokenWei);
  });

  it('should fail to [transferFrom] more than allowed', async function() {
    let from = owner;
    let to = publicKeys[2];
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
    let to = publicKeys[2];
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

  it('should fail [changeTokenName] for non-owner', async function() {
    let notOwner = publicKeys[2];
    let notOwnerPrivateKey = privateKeys[2];

    let data = web3Contract.changeTokenName.getData('NewName');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should properly [changeTokenName] by the owner', async function() {
    let ownerPrivateKey = privateKeys[0];
    let oldName = await contract.name.call();

    // attempt to `changeTokenName` 
    let data = web3Contract.changeTokenName.getData('NewName');

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let newName = await contract.name.call();

    assert.strictEqual(oldName, 'Token');
    assert.strictEqual(newName, 'NewName');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail [changeTokenSymbol] for not the owner', async function() {
    let notOwner = publicKeys[3];
    let notOwnerPrivateKey = privateKeys[3];

    let data = web3Contract.changeTokenSymbol.getData('XYZ');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should properly [changeTokenSymbol] by the owner', async function() {
    let ownerPrivateKey = privateKeys[0];
    let oldSymbol = await contract.symbol.call();

    // attempt to `changeTokenName` 
    let data = web3Contract.changeTokenSymbol.getData('ABC');

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let newSymbol = await contract.symbol.call();

    assert.strictEqual(oldSymbol, 'TOK');
    assert.strictEqual(newSymbol, 'ABC');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should properly [createCrowdsale] for owner', async function() {
    let ownerPrivateKey = privateKeys[0];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to `createCrowdsale` that is open and happening now
    let data = web3Contract.createCrowdsale.getData(
      'crowdsale1', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      400, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000), /* endTime */
    );

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, true);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should [createCrowdsale] when passing 0 endTime', async function() {
    let ownerPrivateKey = privateKeys[0];

    let open = await contract.crowdsaleIsOpen.call('crowdsale2');

    // attempt to `createCrowdsale` with a max int end time
    let data = web3Contract.createCrowdsale.getData(
      'crowdsale2', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      400, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      0, /* endTime */
    );

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, true);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [createCrowdsale] with existing name', async function() {
    let ownerPrivateKey = privateKeys[0];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to `createCrowdsale` that is already existing
    let data = web3Contract.createCrowdsale.getData(
      'crowdsale1', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      400, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000), /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail to [createCrowdsale] bad exchangeRate', async function() {
    let ownerPrivateKey = privateKeys[0];

    let data = web3Contract.createCrowdsale.getData(
      'crowdsale3', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      0, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000), /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail to [createCrowdsale] bad dates', async function() {
    let ownerPrivateKey = privateKeys[0];

    let data = web3Contract.createCrowdsale.getData(
      'crowdsale3', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      123, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 + 1000), /* startTime */
      Math.floor(new Date().getTime() / 1000 - 5) /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('[crowdsaleIsOpen] should fail for non-existing cs', async function() {
    let notOwner = publicKeys[1];
    let notOwnerPrivateKey = privateKeys[1];

    let open = await contract.crowdsaleIsOpen.call('crowdsale3');

    assert.strictEqual(open, false);
  });

  it('should fail to [createCrowdsale] bad name', async function() {
    let ownerPrivateKey = privateKeys[0];

    let data = web3Contract.createCrowdsale.getData(
      '', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      123, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000) /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('[crowdsaleIsOpen] should return true for open cs', async function() {
    let notOwner = publicKeys[2];
    let notOwnerPrivateKey = privateKeys[2];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, true);
  });

  it('should fail to [closeCrowdsale] for non-owner', async function() {
    let notOwner = publicKeys[2];
    let notOwnerPrivateKey = privateKeys[2];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to close the crowdsale
    let data = web3Contract.closeCrowdsale.getData('crowdsale1');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, true);
    assert.strictEqual(openAfter, true);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [closeCrowdsale] for owner only', async function() {
    let ownerPrivateKey = privateKeys[0];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to close the crowdsale
    let data = web3Contract.closeCrowdsale.getData('crowdsale1');

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, true);
    assert.strictEqual(openAfter, false);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('[crowdsaleIsOpen] should return false for closed cs', async function() {
    let notOwner = publicKeys[2];
    let notOwnerPrivateKey = privateKeys[2];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
  });

  it('should fail to [openCrowdsale] for non-owner', async function() {
    let notOwner = publicKeys[2];
    let notOwnerPrivateKey = privateKeys[2];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    let data = web3Contract.openCrowdsale.getData('crowdsale1');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, false);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [openCrowdsale] for owner only', async function() {
    let ownerPrivateKey = privateKeys[0];

    let open = await contract.crowdsaleIsOpen.call('crowdsale1');

    let data = web3Contract.openCrowdsale.getData('crowdsale1');

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, true);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [crowdsaleAddTokens] for non-owner', async function() {
    let notOwner = publicKeys[1];
    let notOwnerPrivateKey = privateKeys[1];

    let crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokens = await contract.balanceOf.call(owner);
    let notOwnerTokens = await contract.balanceOf.call(notOwner);

    let data = web3Contract.crowdsaleAddTokens.getData(
      'crowdsale1',
      web3.toBigNumber('100')
    );

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokensAfter = await contract.balanceOf.call(owner);
    let notOwnerTokensAfter = await contract.balanceOf.call(notOwner);

    crowdsaleTokens = crowdsaleTokens.toString();
    ownerTokens = ownerTokens.toString();
    notOwnerTokens = notOwnerTokens.toString();
    crowdsaleTokensAfter = crowdsaleTokensAfter.toString();
    ownerTokensAfter = ownerTokensAfter.toString();
    notOwnerTokensAfter = notOwnerTokensAfter.toString();

    assert.strictEqual(crowdsaleTokens, crowdsaleTokensAfter);
    assert.strictEqual(ownerTokens, ownerTokensAfter);
    assert.strictEqual(notOwnerTokens, notOwnerTokensAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail to [crowdsaleAddTokens] too many tokens', async function() {
    let ownerPrivateKey = privateKeys[0];

    let crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokens = await contract.balanceOf.call(owner);

    let data = web3Contract.crowdsaleAddTokens.getData(
      'crowdsale1',
      web3.toBigNumber('1e+50')
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokensAfter = await contract.balanceOf.call(owner);

    crowdsaleTokens = crowdsaleTokens.toString();
    ownerTokens = ownerTokens.toString();
    crowdsaleTokensAfter = crowdsaleTokensAfter.toString();
    ownerTokensAfter = ownerTokensAfter.toString();

    assert.strictEqual(crowdsaleTokens, crowdsaleTokensAfter);
    assert.strictEqual(ownerTokens, ownerTokensAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [crowdsaleAddTokens] for owner only', async function() {
    let ownerPrivateKey = privateKeys[0];

    let crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokens = await contract.balanceOf.call(owner);

    let data = web3Contract.crowdsaleAddTokens.getData(
      'crowdsale1',
      web3.toBigNumber('5000')
    );

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokensAfter = await contract.balanceOf.call(owner);

    crowdsaleTokens = crowdsaleTokens.toString();
    ownerTokens = ownerTokens.toString();
    crowdsaleTokensAfter = crowdsaleTokensAfter.toString();
    ownerTokensAfter = ownerTokensAfter.toString();

    assert.strictEqual(crowdsaleTokens, '50000');
    assert.strictEqual(ownerTokens, '9.999999999999999999939e+26');
    assert.strictEqual(crowdsaleTokensAfter, '55000');
    assert.strictEqual(ownerTokensAfter, '9.99999999999999999993895e+26');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [crowdsaleRemoveTokens] for non-owner', async function() {
    let notOwner = publicKeys[1];
    let notOwnerPrivateKey = privateKeys[1];

    let crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokens = await contract.balanceOf.call(owner);
    let notOwnerTokens = await contract.balanceOf.call(notOwner);

    let data = web3Contract.crowdsaleRemoveTokens.getData(
      'crowdsale1',
      web3.toBigNumber('100')
    );

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokensAfter = await contract.balanceOf.call(owner);
    let notOwnerTokensAfter = await contract.balanceOf.call(notOwner);

    crowdsaleTokens = crowdsaleTokens.toString();
    ownerTokens = ownerTokens.toString();
    notOwnerTokens = notOwnerTokens.toString();
    crowdsaleTokensAfter = crowdsaleTokensAfter.toString();
    ownerTokensAfter = ownerTokensAfter.toString();
    notOwnerTokensAfter = notOwnerTokensAfter.toString();

    assert.strictEqual(crowdsaleTokens, crowdsaleTokensAfter);
    assert.strictEqual(ownerTokens, ownerTokensAfter);
    assert.strictEqual(notOwnerTokens, notOwnerTokensAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsaleRemoveTokens] too many tokens', async function() {
    let ownerPrivateKey = privateKeys[0];

    let crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokens = await contract.balanceOf.call(owner);

    let data = web3Contract.crowdsaleRemoveTokens.getData(
      'crowdsale1',
      web3.toBigNumber('1e+50')
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokensAfter = await contract.balanceOf.call(owner);

    crowdsaleTokens = crowdsaleTokens.toString();
    ownerTokens = ownerTokens.toString();
    crowdsaleTokensAfter = crowdsaleTokensAfter.toString();
    ownerTokensAfter = ownerTokensAfter.toString();

    assert.strictEqual(crowdsaleTokens, crowdsaleTokensAfter);
    assert.strictEqual(ownerTokens, ownerTokensAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [crowdsaleRemoveTokens] for owner only', async function() {
    let ownerPrivateKey = privateKeys[0];

    let crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokens = await contract.balanceOf.call(owner);

    let data = web3Contract.crowdsaleRemoveTokens.getData(
      'crowdsale1',
      web3.toBigNumber('5000')
    );

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    let ownerTokensAfter = await contract.balanceOf.call(owner);

    crowdsaleTokens = crowdsaleTokens.toString();
    ownerTokens = ownerTokens.toString();
    crowdsaleTokensAfter = crowdsaleTokensAfter.toString();
    ownerTokensAfter = ownerTokensAfter.toString();

    assert.strictEqual(crowdsaleTokens, '55000');
    assert.strictEqual(ownerTokens, '9.99999999999999999993895e+26');
    assert.strictEqual(crowdsaleTokensAfter, '50000');
    assert.strictEqual(ownerTokensAfter, '9.999999999999999999939e+26');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail [crowdsaleUpdateExchangeRate] for non-owner', async function() {
    let notOwner = publicKeys[2];
    let notOwnerPrivateKey = privateKeys[2];

    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();

    let data = web3Contract.crowdsaleUpdateExchangeRate.getData(
      'crowdsale1',
      5
    );

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRateAfter = csDetailsAfter[4].toNumber();

    exchangeRate = exchangeRate.toString();
    exchangeRateAfter = exchangeRateAfter.toString();

    assert.strictEqual(exchangeRate, exchangeRateAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsaleUpdateExchangeRate] bad name', async function() {
    let ownerPrivateKey = privateKeys[0];

    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();

    let data = web3Contract.crowdsaleUpdateExchangeRate.getData(
      'badnameforcrowdsale',
      5
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRateAfter = csDetailsAfter[4].toNumber();

    exchangeRate = exchangeRate.toString();
    exchangeRateAfter = exchangeRateAfter.toString();

    assert.strictEqual(exchangeRate, exchangeRateAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [crowdsaleUpdateExchangeRate] for owner only', async function() {
    let ownerPrivateKey = privateKeys[0];

    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();

    let data = web3Contract.crowdsaleUpdateExchangeRate.getData(
      'crowdsale1',
      500
    );

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    let csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRateAfter = csDetailsAfter[4].toNumber();

    exchangeRate = exchangeRate.toString();
    exchangeRateAfter = exchangeRateAfter.toString();

    assert.strictEqual(exchangeRate, '400');
    assert.strictEqual(exchangeRateAfter, '500');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail [crowdsalePurchase] purchase too large', async function() {
    let ownerPrivateKey = privateKeys[0];

    let ownerBalance = await contract.balanceOf.call(owner);
    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();
    let csTokenBalance = csDetails[3];
    let value = 500000;

    let data = web3Contract.crowdsalePurchase.getData('crowdsale1', owner);

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        value
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let ownerBalanceAfter = await contract.balanceOf.call(owner);
    let csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    let csTokenBalanceAfter = csDetailsAfter[3];

    ownerBalance = ownerBalance.toString();
    ownerBalanceAfter = ownerBalanceAfter.toString();
    csTokenBalance = csTokenBalance.toString();
    csTokenBalanceAfter = csTokenBalanceAfter.toString();

    assert.strictEqual(ownerBalance, ownerBalanceAfter);
    assert.strictEqual(csTokenBalance, csTokenBalanceAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsalePurchase] for bad name', async function() {
    let ownerPrivateKey = privateKeys[0];

    let ownerBalance = await contract.balanceOf.call(owner);
    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();
    let csTokenBalance = csDetails[3];
    let value = 5;

    let data = web3Contract.crowdsalePurchase.getData(
      'notacrowdsalename',
      owner
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        value
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let ownerBalanceAfter = await contract.balanceOf.call(owner);
    let csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    ownerBalance = ownerBalance.toString();
    ownerBalanceAfter = ownerBalanceAfter.toString();
    csTokenBalance = csTokenBalance.toString();
    csTokenBalanceAfter = csTokenBalanceAfter.toString();

    assert.strictEqual(ownerBalance, ownerBalanceAfter);
    assert.strictEqual(csTokenBalance, csTokenBalanceAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsalePurchase] for empty name', async function() {
    let ownerPrivateKey = privateKeys[0];

    let ownerBalance = await contract.balanceOf.call(owner);
    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();
    let csTokenBalance = csDetails[3];
    let value = 5;

    let data = web3Contract.crowdsalePurchase.getData('', owner);

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        value
      );
    } catch (error) {
      errorMessage = error.message;
    }

    let ownerBalanceAfter = await contract.balanceOf.call(owner);
    let csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    ownerBalance = ownerBalance.toString();
    ownerBalanceAfter = ownerBalanceAfter.toString();
    csTokenBalance = csTokenBalance.toString();
    csTokenBalanceAfter = csTokenBalanceAfter.toString();

    assert.strictEqual(ownerBalance, ownerBalanceAfter);
    assert.strictEqual(csTokenBalance, csTokenBalanceAfter);

    let expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should properly [crowdsalePurchase] for owner', async function() {
    let ownerPrivateKey = privateKeys[0];

    let ownerBalance = await contract.balanceOf.call(owner);
    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();
    let csTokenBalance = csDetails[3];
    let value = 5;

    let data = web3Contract.crowdsalePurchase.getData('crowdsale1', owner);

    let result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      value
    );

    let ownerBalanceAfter = await contract.balanceOf.call(owner);
    let csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    ownerBalance = ownerBalance.toString();
    ownerBalanceAfter = ownerBalanceAfter.toString();
    csTokenBalance = csTokenBalance.toString();
    csTokenBalanceAfter = csTokenBalanceAfter.toString();

    assert.strictEqual(ownerBalance, '9.999999999999999999939e+26');
    assert.strictEqual(ownerBalanceAfter, '9.999999999999999999939025e+26');
    assert.strictEqual(csTokenBalance, '50000');
    assert.strictEqual(csTokenBalanceAfter, '47500');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should properly [crowdsalePurchase] for non-owner', async function() {
    let beneficiary = publicKeys[3];
    let notOwner = publicKeys[1];
    let notOwnerPrivateKey = privateKeys[1];

    let beneficiaryBalance = await contract.balanceOf.call(beneficiary);
    let notOwnerBalance = await contract.balanceOf.call(notOwner);
    let csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    let exchangeRate = csDetails[4].toNumber();
    let csTokenBalance = csDetails[3];
    let value = 5;

    let data = web3Contract.crowdsalePurchase.getData(
      'crowdsale1', 
      beneficiary
    );

    let result = await rawTransaction(
      notOwner,
      notOwnerPrivateKey,
      contract.address,
      data,
      value
    );

    let beneficiaryBalanceAfter = await contract.balanceOf.call(beneficiary);
    let notOwnerBalanceAfter = await contract.balanceOf.call(notOwner);
    let csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    notOwnerBalance = notOwnerBalance.toString();
    notOwnerBalanceAfter = notOwnerBalanceAfter.toString();
    beneficiaryBalance = beneficiaryBalance.toString();
    beneficiaryBalanceAfter = beneficiaryBalanceAfter.toString();
    csTokenBalance = csTokenBalance.toString();
    csTokenBalanceAfter = csTokenBalanceAfter.toString();

    assert.strictEqual(notOwnerBalance, notOwnerBalanceAfter);
    assert.strictEqual(beneficiaryBalance, '0');
    assert.strictEqual(beneficiaryBalanceAfter, '2500');
    assert.strictEqual(csTokenBalance, '47500');
    assert.strictEqual(csTokenBalanceAfter, '45000');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should account for every [event] execution', function(done) {
    wait(5000).then(() => {
      assert.strictEqual(eventCounter.Transfer, 7);
      assert.strictEqual(eventCounter.Approval, 1);
      assert.strictEqual(eventCounter.TokenNameChanged, 1);
      assert.strictEqual(eventCounter.TokenSymbolChanged, 1);
      assert.strictEqual(eventCounter.CrowdsaleDeployed, 2);
      done();
    });
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

function wait (ms) { 
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
};
