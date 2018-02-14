import token_artifacts from '../../build/contracts/Token.json';

var pubnub = new PubNub({
  publishKey : '__YOUR_PUBNUB_PUBLISH_KEY__',
  subscribeKey : '__YOUR_PUBNUB_SUBSCRIBE_KEY__'
});

var pubnubSMSChannel = '__YOUR_FUNCTION_LISTENING_CHANNEL__';

var web3;
var accounts;
var owner;
var contract;
var truffleDevRpc = 'http://127.0.0.1:9545/';
var truffleDevContractAddress = '0x345ca3e014aaf5dca488057592ee47305d9b3e10';

window.App = {
  start: function() {
    contract = web3.eth.contract(token_artifacts.abi)
      .at(truffleDevContractAddress);

    // Get the initial accounts
    web3.eth.getAccounts(function(err, accs) {
      if (err !== null || accs.length === 0) {
        alert(
          'There was an error fetching your accounts. ' +
          'Make sure the Truffle Developer Ethereum client is running.'
        );
        return;
      }

      accounts = accs;
      owner = accounts[0];
    });
  },

  setTransferStatus: function(message) {
    transferStatus.innerText = message;
  },

  setCrowdsaleStatus: function(message) {
    crowdsaleStatus.innerText = message;
  },

  setBuyStatus: function(message) {
    buyStatus.innerText = message;
  },

  setSmsStatus: function(message) {
    smsStatus.innerText = message;
  },

  balanceOf: function() {
    var address = walletAddress.value;
    var walletWei = contract.balanceOf.call(address, function(error, balance) {
      if (error) {
        window.App.setTransferStatus('Error: ' + error);
      } else {
        // Balance is in wei. If your token doesn't have 18 decimal places,
        // you will need to write your own conversion.
        var walletToken = web3.fromWei(balance, 'ether');
        balanceLabel.innerText = walletToken.toString();
      }
    });
  },

  transfer: function() {
    // Go from ether to wei denomination. If your token doesn't have 18 
    // decimal places, you will need to write your own conversion.
    var amountToken = transferAmount.value;
    var amount = web3.toWei(amountToken);

    var sender = transferFromAddress.value;
    var receiver = transferToAddress.value;

    window.App.setTransferStatus('Initiating transaction... (please wait)');

    contract.transfer(
      receiver,
      amount,
      {from: sender},
      function(error, transactionHash) {
        if (error) {
          window.App.setTransferStatus('Error: ' + error);
        } else {
          window.App.setTransferStatus('Transaction complete!');
        }
    });
  },

  buy: function() {
    var name = buyCrowdsaleName.value;
    var address = beneficiaryAddress.value;
    var amount = buyAmount.value;

    contract.crowdsalePurchase(
      name,
      address,
      {from: owner, value: amount},
      function(error, transactionHash) {
        if (error) {
          window.App.setBuyStatus('Error: ' + error);
        } else {
          window.App.setBuyStatus(
            'Purchase complete! Check the wallet TOK balance'
          );
        }
    });
  },

  launchCrowdsale: function() {
    // See constraints for these in the Token Contract (contracts/Token.sol)
    var name = crowdsaleName.value;
    var open = true;
    var initialTokenSupply = web3.toWei(100000); // 100,000 TOK
    var exchangeRate = 3000000000000000000; // 3 TOK for 1 ETH
    var startTime = Math.floor(new Date().getTime() / 1000);
    var endTime = 0; // no end time

    contract.createCrowdsale(
      name,
      open,
      initialTokenSupply,
      exchangeRate,
      startTime,
      endTime,
      {
        from: owner,
        gas: 200000
      },
      function(error, transactionHash) {
        if (error) {
          console.error(error);
          window.App.setCrowdsaleStatus(
            'Error during launch, see developer console.'
          );
        } else {
          window.App.setCrowdsaleStatus(
            'The Crowdsale "' + name + '" is now live.'
          );
          window.App.smsCrowdOnNewCrowdsale(name, contract.address);
        }
      }
    );
  },

  // Sends text messages via PubNub FUNCTIONS
  // First deploy app/pubnub-functions/sms-handler.js
  // at admin.pubnub.com
  smsCrowdOnNewCrowdsale: function(name, address) {
    var publishConfig = {
      channel : pubnubSMSChannel,
      message : {
        'crowdsaleName': name,
        'contractAddress': address
      }
    }

    pubnub.publish(publishConfig, function(status, response) {
      console.log(status, response);
      if (status.error) {
        console.error(status.error);
        window.App.setSmsStatus(
          'Error while texting the crowd, see developer console.'
        );
      } else {
        window.App.setSmsStatus(
          'The crowd has been notified with SMS via ClickSend.'
        );
      }
    });
  }
};

window.addEventListener('load', function() {
  let providerURI = truffleDevRpc;
  let web3Provider = new Web3.providers.HttpProvider(providerURI);
  web3 = new Web3(web3Provider);

  App.start();
});

var walletAddress = document.getElementById('walletAddress');
var balanceButton = document.getElementById('balanceButton');
var balanceLabel = document.getElementById('Balance');
var transferFromAddress = document.getElementById('transferFromAddress');
var transferToAddress = document.getElementById('transferToAddress');
var transferAmount = document.getElementById('transferAmount');
var transferButton = document.getElementById('transferButton');
var transferStatus = document.getElementById('transferStatus');
var buyCrowdsaleName = document.getElementById('buyCrowdsaleName');
var beneficiaryAddress = document.getElementById('beneficiaryAddress');
var buyAmount = document.getElementById('buyAmount');
var buyButton = document.getElementById('buyButton');
var buyStatus = document.getElementById('buyStatus');
var launchCrowdsaleButton = document.getElementById('launchButton');
var crowdsaleStatus = document.getElementById('crowdsaleStatus');
var crowdsaleName = document.getElementById('crowdsaleName');
var smsStatus = document.getElementById('smsStatus');

balanceButton.onclick = window.App.balanceOf;
transferButton.onclick = window.App.transfer;
buyButton.onclick = window.App.buy;
launchCrowdsaleButton.onclick = window.App.launchCrowdsale;
