const xhr = require('xhr');
const basicAuth = require('codec/auth');
const username = '__YOUR_USER_NAME__';
const authKey = '__YOUR_AUTH_KEY__';
const uri = 'https://rest.clicksend.com/v3/sms/send';
const authorization = basicAuth.basic(username, authKey);

export default (request) => { 
  let crowdsaleName = request.message.crowdsaleName;
  let contractAddress = request.message.contractAddress;

  let crowdPhoneNumbers = ['+19999999999'];
  let body = `Crowdsale ${crowdsaleName} for TOK is now open!` +
    ` Ethereum Address: ${contractAddress}`;

  let messages = [];

  for (let number of crowdPhoneNumbers) {
    messages.push({
      source: 'pubnub-blocks',
      from: 'cstoken',
      body: body,
      to: number,
      custom_string: `TOK-${crowdsaleName}`
    });
  }

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
