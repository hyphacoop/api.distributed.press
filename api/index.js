const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer  = require('multer');
const tar = require('tar-fs');
const gunzip = require('gunzip-maybe');

// Application constants
const apiVersion = 'v0';
const confDir = `${require('os').homedir()}/.distributed-press`;
const confFile = `${confDir}/config.json`;
const projFile = `${confDir}/projects.json`;

// Application configurations
let dataDir = `${confDir}/data`;
let projDir;
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
    projDir = `${dataDir}/projects`;
  }
  if (!fs.existsSync(dataDir)) {
    console.log(`Data directory not found at ${dataDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(projDir)) {
    console.log(`Projects directory not found at ${projDir}`);
    process.exit(1);
  }

  console.log(`API server started with configuration at ${confFile}`);
  console.log(`Data directory located at ${dataDir}`);
} catch (error) {
  console.log(error);
  process.exit(1);
}
const uploadDir = `${dataDir}/uploads`;
const upload = multer({ dest: uploadDir });
let projMap = readProjectMap(projFile);

// API server constants
const app = express();
const port = process.env.PORT || 3030;
const actions = [
    'monetization/balances'
  ];

//
// Publication APIs
//

// curl -v http://localhost:3030/v0/publication/configure -H "Content-Type: multipart/form-data" -H "Accept: application/json" -H "Authorization: Bearer ${PROJECT_API_KEY}" -F "file=@config.json"
app.post(`/${apiVersion}/publication/configure`, upload.single('file'), function (req, res, next) {
  // Get project from request
  let project;
  if (req.header('Authorization')) {
    const apiKey = req.header('Authorization').replace('Bearer ', '');
    project = getProjectFromApiKey(apiKey);
    if (project === undefined) {
      return res.status(401).json({
        error: "The 'Authorization' header does not contain a valid API key",
        errorCode: 1005,
        timestamp: new Date().toJSON()
      });
    }
  }

  // Copy uploaded configuration file to project
  try {
    fs.renameSync(`${uploadDir}/${req.file.filename}`, `${projDir}/${project}/config.json`);
    console.log(`New configuration uploaded for ${project}`);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: 'An unknown error occurred',
      errorCode: 1000,
      timestamp: new Date().toJSON()
    });
  }
  return res.status(201).json({
      error: '',
      errorCode: 0,
      timestamp: new Date().toJSON()
    });
});

// curl -v http://localhost:3030/v0/publication/publish -H "Content-Type: multipart/form-data" -H "Accept: application/json" -H "Authorization: Bearer ${PROJECT_API_KEY}" -F "file=@www.tar.gz"
app.post(`/${apiVersion}/publication/publish`, upload.single('file'), function (req, res) {
  // Get project from request
  let project;
  if (req.header('Authorization')) {
    const apiKey = req.header('Authorization').replace('Bearer ', '');
    project = getProjectFromApiKey(apiKey);
    if (project === undefined) {
      return res.status(401).json({
        error: "The 'Authorization' header does not contain a valid API key",
        errorCode: 1005,
        timestamp: new Date().toJSON()
      });
    }
  }

  // Publish www archive to project www directory
  try {
    let srcFile = `${uploadDir}/${req.file.filename}`;
    let targetDir = `${projDir}/${project}/www`;
    
    // Delete existing www directory
    fs.rmSync(targetDir, { recursive: true, force: true });
    
    // Untar uploaded www archive to project
    fs.createReadStream(srcFile).on('error', (error) => console.log(error))
      .pipe(gunzip()).on('error', (error) => console.log(error))
      .pipe(tar.extract(targetDir)).on('error', (error) => console.log(error))
      .on('finish', () => {
        try {
          fs.unlinkSync(srcFile)
          console.log(`New website published for ${project}`);
        } catch (error) {
          console.log(error)
        }
      });
    console.log(`New website archive uploaded for ${project}`);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: 'An unknown error occurred',
      errorCode: 1000,
      timestamp: new Date().toJSON()
    });
  }
  return res.status(202).json({
      error: '',
      errorCode: 0,
      timestamp: new Date().toJSON()
    });
});

//
// Monetization APIs
//

// curl -v http://localhost:3030/v0/monetization/balances.json?project=staging.compost.digital
app.get(`/${apiVersion}/:group/:action.json`, function(req, res) {
  // Get project from request
  let project;
  if (req.header('Authorization')) { // First, from API key if it exists in the header
    const apiKey = req.header('Authorization').replace('Bearer ', '');
    project = getProjectFromApiKey(apiKey);
    if (project === undefined) {
      return res.status(401).json({
        error: "The 'Authorization' header does not contain a valid API key",
        errorCode: 1005,
        timestamp: new Date().toJSON()
      });
    }
  } else if (req.query.project) { // Then, try from the 'project' query parameter
    project = req.query.project;
  } else {
    project = req.get('host'); // Last, from the host in the URL
  }

  // Read API response
  try {
    let resFile = fs.readFileSync(`${projDir}/${project}/api/${apiVersion}/${req.params.group}/${req.params.action}.json`);
    return res.json(JSON.parse(resFile));
  } catch (error) {
    // Check if action is supported
    if (!actions.includes(`${req.params.group}/${req.params.action}`)) {
      return res.status(400).json({
        error: `The action '${req.params.group}/${req.params.action}' is not supported`,
        errorCode: 1001,
        timestamp: new Date().toJSON()
      });
    }
    // Check if project exists
    if (!fs.existsSync(`${projDir}/${project}`)) {
      return res.status(404).json({
        error: `The project '${project}' is not available`,
        errorCode: 1002,
        timestamp: new Date().toJSON()
      });
    }
    // Other errors
    return res.status(500).json({
      error: 'An unknown error occurred',
      errorCode: 1000,
      timestamp: new Date().toJSON()
    });
  }
});

//
// Internal APIs
//

// curl -v -X POST http://localhost:3030/v0/internal/addApiKey?project=staging.compost.digital
app.post(`/${apiVersion}/internal/addApiKey`, function (req, res) {
  // Verify internal origin using host in the URL
  if (req.get('host') !== `localhost:${port}`) {
    return res.status(401).json({
      error: `Internal API must be called from localhost`,
      errorCode: 1004,
      timestamp: new Date().toJSON()
    });    
  }

  // Validate 'project' query parameter
  if (req.query.project === undefined || req.query.project.trim().indexOf('.') <= 0) {
    return res.status(400).json({
      error: `The project '${req.query.project}' must be a valid domain`,
      errorCode: 1003,
      timestamp: new Date().toJSON()
    });
  }

  // Add new API key
  const project = req.query.project.trim();
  const apiKey = addNewApiKey(project);
  if (apiKey) {
    return res.status(201).json({
      apiKey: apiKey,
      error: '',
      errorCode: 0,
      timestamp: new Date().toJSON()
    });
  } else {
    return res.status(500).json({
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

function addNewApiKey(project) {
  try {
    // Generate new API key and hash
    const apiKey = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Write hash to file
    const file = fs.readFileSync(projFile);
    const projects = JSON.parse(file);
    const index = projects['active'].findIndex((item) => item['domain'] === project);
    if (index === -1) {
      // Add new project to project list
      projects['active'].push({
        domain: project,
        apiKeyHashes: [
          hash
        ]
      });
    } else {
      // Add new API key to existing project
      projects['active'][index]['apiKeyHashes'].push(hash);
    }
    fs.writeFileSync(projFile, JSON.stringify(projects));

    // Refresh project map
    projMap = readProjectMap(projFile);
    
    // Return new API key
    return apiKey;
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

function readProjectMap(filePath) {
  const map = new Map();
  try {
    // Read project list
    const file = fs.readFileSync(filePath);
    const projects = JSON.parse(file);

    // Create project map from new copy
    projects['active'].forEach((project, index) => {
      project['apiKeyHashes'].forEach((hash, index) => {
        map.set(hash, project['domain']);
      });
    });
  } catch (error) {
    console.log(error);
  }
  return map;
}

function getProjectFromApiKey(apiKey) {
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  return projMap.get(hash);
}