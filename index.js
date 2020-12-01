const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const app = express();

const apiVersion = 'v0';
const port = process.env.PORT || 3000;

let db = fs.readFileSync('db.json');
let ethMap = JSON.parse(db);

app.get(`/${apiVersion}/publication/*`, function(req, res) {
  // TODO
  res.send('Hello World!');
});

app.get(`/${apiVersion}/monetization/:action/:org`, function(req, res) {
  switch(req.params.action) {
    case 'eth':
      urlRemote = `https://api.etherscan.io/api?module=account&action=balance&address=${ethMap[req.params.org]}&tag=latest`;
      console.log(`Fetching from remote ${urlRemote}`);
      fetch(urlRemote)
        .then(resRemote => resRemote.json())
        .then(json => {
          res.json({
            balance: json['result'], 
            currency: 'ETH',
            error: '',
            errorCode: ''
          })
      });
      break;
  	case 'oc':
      urlRemote = `https://opencollective.com/${req.params.org}.json`;
      console.log(`Fetching from remote ${urlRemote}`);
      fetch(urlRemote)
        .then(resRemote => resRemote.json())
        .then(json => {
          res.json({
            balance: json['balance'], 
            currency: 'CAD',
            error: '',
            errorCode: ''
          })
      });
      break;
    default:
      res.json({
        error: 'unknown action',
        errorCode: '100'
      });
  }
});

app.listen(port, function () {
  console.log(`Server running on port ${port}`);
});