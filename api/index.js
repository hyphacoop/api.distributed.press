const express = require('express');
const fs = require('fs');

// Application constants
const apiVersion = 'v0';
const confDir = `${require('os').homedir()}/.distributed-press`;
const confFile = `${confDir}/config.json`;

// Application configurations
let dataDir = `${confDir}/data`;
let conf;
try {
  // Read application configurations
  if (!fs.existsSync(confFile)) {
    console.log(`Run backend module to set up application configuration before starting API server`);
    process.exit(1);
  }
  const file = fs.readFileSync(confFile);
  conf = JSON.parse(file);

  // Read data directory from application configurations
  if (conf['dataDirectory'] && conf['dataDirectory'].trim().length > 0) {
    dataDir = conf['dataDirectory'];
  }
  if (!fs.existsSync(dataDir)) {
    console.log(`Data directory not found at ${dataDir}`);
    process.exit(1);
  }

  console.log(`API server started with configuration at ${confFile}`);
  console.log(`Data directory located at ${dataDir}`);
} catch (error) {
  console.log(error);
  process.exit(1);
}

// API server constants
const app = express();
const port = process.env.PORT || 3030;
const actions = [
    'monetization/balances'
  ];

// Set up APIs
app.get(`/${apiVersion}/:group/:action.json`, function(req, res) {
  // Get project from request, first from API key if it exists in the header
  let project;
  if (req.header('Authorization')) {
    const apiKey = req.header('Authorization').replace('Bearer ', '');
    project = getProjectFromApiKey(apiKey);
  } else if (req.query.project) { // Try to get it from the 'project' query parameter
    project = req.query.project;
  } else {
    project = req.get('host'); // Get it from the 'project' query parameter
  }

  // Read API response
  try {
    let resFile = fs.readFileSync(`${dataDir}/${project}/api/${apiVersion}/${req.params.group}/${req.params.action}.json`);
    res.json(JSON.parse(resFile))
  } catch (error) {
    // Check if action is supported
    if (!actions.includes(`${req.params.group}/${req.params.action}`)) {
      res.json({
        error: `The action '${req.params.group}/${req.params.action}' is not supported`,
        errorCode: 1001,
        timestamp: new Date().toJSON()
      });
      return
    }
    // Check if project exists
    if (!fs.existsSync(`${dataDir}/${project}/`)) {
      res.json({
        error: `The project '${project}' is not available`,
        errorCode: 1002,
        timestamp: new Date().toJSON()
      });
      return
    }
    res.json({
      error: 'An unknown error occurred',
      errorCode: 1000,
      timestamp: new Date().toJSON()
    });
  }
});

// Start listening
app.listen(port, function () {
  console.log(`API server running on port ${port}`);
});

// TODO
function getProjectFromApiKey(apiKey) {
  return 'project';
}