const xhr = require('xhr');
const basicAuth = require('codec/auth');

// Use the PubNub Functions Vault Module to store these keys securely.
const username = '__YOUR_CLICKSEND_USER_NAME__';
const authKey = '__YOUR_CLICKSEND_AUTH_KEY__';
const uri = 'https://rest.clicksend.com/v3/sms/send';
const authorization = basicAuth.basic(username, authKey);

export default (request) => { 
  let crowdsaleName = request.message.crowdsaleName;
  let contractAddress = request.message.contractAddress;

  // Ideally, the phone numbers would be in the PN request body or they could be
  // fetched from a secure endpoint right here using `return xhr.fetch().then()`
  // Never hard code phone numbers in function code.
  let crowdPhoneNumbers = ['+19999999999'];
  let body = `Crowdsale "${crowdsaleName}" for TOK is now open!` +
    ` Ethereum Address: ${contractAddress}`;

  let messages = [];

  // Create an object for each number that will be SMSed.
  // Object array will be the POST body to ClickSend.
  for (let number of crowdPhoneNumbers) {
    messages.push({
      source: 'pubnub-blocks',
      from: 'cstoken',
      body: body,
      to: number,
      custom_string: `TOK-${crowdsaleName}`
    });
  }

  // POST to ClickSend API
  return xhr.fetch(uri, {
    'method'  : 'POST',
    'headers' : {
      'Authorization' : authorization,
      'Content-Type': 'application/json'
    },
    'body': JSON.stringify({
      'messages': messages
    }),
    'timeout' : 5000
  })
  .then((res) => {
    return request.ok();
  })
  .catch((err) => {
    console.error(err);
    return request.abort();
  });
};
