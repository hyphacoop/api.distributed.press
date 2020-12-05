const express = require('express');
const fs = require('fs');

const app = express();
const apiVersion = 'v0';
const port = process.env.PORT || 3030;

const actions = [
    'monetization/balances'
  ];

app.get(`/:project/${apiVersion}/:group/:action`, function(req, res) {
  try {
    let resFile = fs.readFileSync(`../data/${req.params.project}/${apiVersion}/${req.params.group}/${req.params.action}.json`);
    res.json(JSON.parse(resFile))
  } catch (error) {
    // Check if action is supported
    if (!actions.includes(`${req.params.group}/${req.params.action}`)) {
      res.json({
        error: `The action '${req.params.group}/${req.params.action}' is not supported`,
        errorCode: '1001'
      });
      return
    }
    // Check if project exists
    if (!fs.existsSync(`../data/${req.params.project}/`)) {
      res.json({
        error: `The project '${req.params.project}' is not available`,
        errorCode: '1002'
      });
      return
    }
    res.json({
      error: 'An unknown error occurred',
      errorCode: '1000'
    });
  }
});

app.listen(port, function () {
  console.log(`API server running on port ${port}`);
});