import token_artifacts from '../../build/contracts/Token.json'

var accounts;
var owner;
var sc;
var truffleDevRpc = 'http://127.0.0.1:9545/';
var truffleDevContractAddress = '0x345ca3e014aaf5dca488057592ee47305d9b3e10';

window.App = {
  start: function() {
    // Bootstrap the Token abstraction for Use.
    sc = web3.eth.contract(token_artifacts.abi)
      .at(truffleDevContractAddress);

    // Get the initial account balance so it can be displayed.
    web3.eth.getAccounts(function(err, accs) {
      if (err != null) {
        alert("There was an error fetching your accounts.");
        return;
      }

      if (accs.length == 0) {
        alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
        return;
      }

      accounts = accs;
      owner = accounts[0];
    });
  },

  setStatus: function(message) {
    statusSpan.innerText = message;
  },

  balanceOf: function(e) {
    e.preventDefault();

    var address = walletAddress.value;
    var walletWei = sc.balanceOf.call(address, function(error, balance) {
      if (error) {
        window.App.setStatus("Error: " + error);
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
    var amountEther = transferAmount.value;
    var amount = web3.toWei(amountEther);

    var sender = transferFromAddress.value;
    var receiver = transferToAddress.value;

    window.App.setStatus("Initiating transaction... (please wait)");

    sc.transfer(
      receiver,
      amount,
      {from: sender},
      function(error, transactionHash) {
        if (error) {
          window.App.setStatus("Error: " + error);
        } else {
          window.App.setStatus("Transaction complete!");
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
var statusSpan = document.getElementById('statusSpan');

balanceButton.onclick = window.App.balanceOf;
transferButton.onclick = window.App.transfer;
