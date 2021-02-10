const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');
const httpPublisherIpv4Address = '198.50.215.6';
const httpPublisherIpv6Address = '2607:5300:203:4014:5074:f2ff:feb1:a87f';
const hyperPublisher = require('hyperdrive-publisher')
const ipfsClient = require('ipfs-http-client')

// Application constants
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
    console.log(`Run backend module to set up application configuration before starting pinning service`);
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
  projDir = `${dataDir}/projects`;
  if (!fs.existsSync(projDir)) {
    console.log(`Projects directory not found at ${projDir}`);
    process.exit(1);
  }

  console.log(`Pinning service started with configuration at ${confFile}`);
  console.log(`Data directory located at ${dataDir}`);
} catch (error) {
  console.log(error);
  process.exit(1);
}

// Pinning service constants
const txtHypercoreWww = '@';
const txtHypercoreApi = 'api';
const txtIpfsWww = '_dnslink';
const txtIpfsApi = '_dnslink.api';

// Runtime settings
const period = conf['dev']['pinningPeriod'] ? conf['dev']['pinningPeriod'] : '0 */15 * * * *'
const { globSource } = ipfsClient;
const ipfs = ipfsClient(conf['ipfsServer']);

// Connect to dat-store
const DatStorageClient = require('dat-storage-client');
const datStoreClient = new DatStorageClient(conf['datStore']['server']);
console.log(`Connecting to dat-store at ${conf['datStore']['server']} ...`);
datStoreClient.login(conf['datStore']['username'], conf['datStore']['password'])
  .catch(function(error) {
    console.log(error);
  });

// Run this job every 15 minutes by default
const job = new cron.CronJob(period, function() {
  try {
    const file = fs.readFileSync(projFile);
    const projects = JSON.parse(file);
    projects['active'].forEach((project, index) => {
      try {
        const projName = project['domain'];
        const projConfFile = `${projDir}/${projName}/config.json`;
        if (!fs.existsSync(projConfFile)) {
          console.log(`Project directory not found at ${projConfFile}, processing of ${projName} skipped`);
          return;
        }
        const proj = JSON.parse(fs.readFileSync(projConfFile));
        const domain = proj['domain'];
        const dirWww = `${projDir}/${projName}/www`;
        const dirApi = `${projDir}/${projName}/api`;

        //Read publication settings from project configuration
        let protoHttp = true;
        let protoHttpDnsUpdate = true;
        let protoIpfs = true;
        let protoHypercore = true;
        if (proj['publication']) {
          if (proj['publication']['protocol']) {

            // Check for known protocols and set flags
            Object.keys(proj['publication']['protocol']).forEach((item) => {
              switch (item) {
                case 'http':
                  protoHttp = (proj['publication']['protocol'][item]['enable'] === true) ? true : false;
                  protoHttpDnsUpdate = (proj['publication']['protocol'][item]['dnsupdate'] === true) ? true : false;
                  break;
                case 'ipfs':
                  protoIpfs = (proj['publication']['protocol'][item]['enable'] === true) ? true : false;
                  break;
                case 'hypercore':
                  protoHypercore = (proj['publication']['protocol'][item]['enable'] === true) ? true : false;
                  break;
                default:
                  console.log(`WARNING: Unknown protocol in publication project JSON - ${item}`);
              }
            });
          }
        }

        // Pin WWW site to Hypercore
        if (protoHypercore) {
          if (fs.existsSync(dirWww)) {
            getDatSeed('dat-seed-www', projName, domain, txtHypercoreWww)
              .then(seed => hyperPublisher.sync({
                seed,
                fsPath: dirWww,
                drivePath: '/',
                syncTime: 600000 // Allow up to 10 minutes for sync
              }))
              .then(({ diff, url }) => {
                // Log any changes to hyperdrive and return url
                console.log(`WWW site for ${projName} pinned at ${url}. Changes:`);
                console.log(diff);
                return url;
              })
              .catch(function(error) {
                console.log(error);
              });
          }
        } else {
          updateDnsRecordDigitalOcean(domain, 'TXT', txtHypercoreWww, '', 300, conf['digitalOceanAccessToken']);
        }

        // Pin WWW site to IPFS
        if (protoIpfs) {
          if (fs.existsSync(dirWww)) {
            ipfs.add(globSource(dirWww, { recursive: true, followSymlinks: false }), { cidVersion: 1, pin: true, timeout: 60000 })
              .then(file => file['cid'])
              .then(cid => {
                console.log(`WWW site for ${projName} pinned at ipfs/${cid}`);

                // Update DNS record
                return updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfsWww, `dnslink=/ipfs/${cid}`, 300, conf['digitalOceanAccessToken']);
              })
              .catch(function(error) {
                console.log(error);
              });
          }
        } else {
          updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfsWww, '', 300, conf['digitalOceanAccessToken']);
        }

        // Pin API responses to Hypercore
        if (protoHypercore) {
          if (fs.existsSync(dirApi)) {
            getDatSeed('dat-seed-api', projName, domain, txtHypercoreApi)
              .then(seed => hyperPublisher.sync({
                seed,
                fsPath: dirApi,
                drivePath: '/'
              }))
              .then(({ diff, url }) => {
                // Log any changes to hyperdrive and return url
                console.log(`API responses for ${projName} pinned at ${url}. Changes:`);
                console.log(diff);
                return url;
              })
              .catch(function(error) {
                console.log(error);
              });
          }
        }

        // Pin API responses to IPFS
        if (protoIpfs) {
          if (fs.existsSync(dirApi)) {
            ipfs.add(globSource(dirApi, { recursive: true, followSymlinks: false }), { cidVersion: 1, pin: true, timeout: 60000 })
              .then(file => file['cid'])
              .then(cid => {
                console.log(`API responses for ${projName} pinned at ipfs/${cid}`);

                // Update DNS record
                return updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfsApi, `dnslink=/ipfs/${cid}`, 300, conf['digitalOceanAccessToken']);
              })
              .catch(function(error) {
                console.log(error);
              });
          }
        } else {
          updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfsApi, '', 300, conf['digitalOceanAccessToken']);
        }

        // Update HTTP A and AAAA record
        if (protoHttpDnsUpdate) {
          updateDnsRecordDigitalOcean(domain, 'AAAA', '@', protoHttp ? `${httpPublisherIpv6Address}` : '', 300, conf['digitalOceanAccessToken']);
          updateDnsRecordDigitalOcean(domain, 'A', '@', protoHttp ? `${httpPublisherIpv4Address}` : '', 300, conf['digitalOceanAccessToken']);
        }
      } catch (error) {
        console.log(error);
      }
    });
  } catch (error) {
    console.log(error);
  }
}, null, true);

async function getDatSeed(datSeedName, projName, domain, recordName) {
  // Read private Dat seed
  const dirPrivate = `${projDir}/${projName}/private`
  let seed;
  try {
    seed = fs.readFileSync(`${dirPrivate}/${datSeedName}`);
  } catch (error) {
    console.log(`Project ${datSeedName} not found`);
  }
  // If no Dat seed is stored, generate new Dat seed and publish hyperdrive
  if (seed === undefined) {
    // Generate new Dat seed
    console.log(`Generating new ${datSeedName} ...`);
    seed = require('crypto').randomBytes(32);

    // Store new Dat seed in private directory of project
    if (!fs.existsSync(dirPrivate)) {
      fs.mkdirSync(dirPrivate, { recursive: true });
    }
    fs.writeFileSync(`${dirPrivate}/${datSeedName}`, seed);
    console.log(`Project ${datSeedName} updated for ${projName}`);

    // Publish hyperdrive to dat-store with new seed
    await hyperPublisher.getURL({ seed })
      .then(url => datStoreClient.add(url))
      .then(() => hyperPublisher.create({ seed }))
      .then(({ url }) => {
        console.log(`New hyperdrive published for ${projName}`);

        // Update DNS record
        const hyperdriveKey = url.replace('hyper://', '');
        return updateDnsRecordDigitalOcean(domain, 'TXT', recordName, `datkey=${hyperdriveKey}`, 300, conf['digitalOceanAccessToken']);
      });
  }
  if (seed === undefined) {
    throw new Error(`Failed to get ${datSeedName}`);
  } else {
    return seed;
  }
}

function addDomainAccountDigitalOcean(domain, doToken) {
  const url = `https://api.digitalocean.com/v2/domains`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${doToken}`
  };
  const data = JSON.stringify({
    name: domain
  });
  console.log(`POST ${url} with data ${data}`);
  return fetch(url, { method: 'POST', headers: headers, body: data })
    .then(res => res.json())
    .then(json => json['domain'] != undefined);
}

function updateDnsRecordDigitalOcean(domain, recordType, recordName, recordData, recordTtl, doToken) {
  // List existing DNS records for domain
  const url = `https://api.digitalocean.com/v2/domains/${domain}/records/`;
  const urlGet = `https://api.digitalocean.com/v2/domains/${domain}/records/?per_page=500`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${doToken}`
  };
  console.log(`GET ${urlGet}`);
  return fetch(urlGet, { headers: headers })
    .then(res => res.json())
    .then(json => {
      if (json['id'] && json['id'] === 'not_found') {
        return addDomainAccountDigitalOcean(domain, doToken)
          .then(res => {
            if (res) {
              return [];
            } else {
              throw `Could not create domain ${domain}`;
            }
          });
      } else {
        return json['domain_records'].filter(record => record['type'] === recordType && record['name'] === recordName);
      }
    })
    .then(txt => {
      let isDelete = false;
      let isUpdate = false;

      // If there is anything other then one entry found, 
      // all entries should be removed then one entry added
      if (txt.length != 1)
        isUpdate = true

      // If there is a record, and recordData is empty an string, delete only
      if (txt.length === 1 && recordData === '') {
        isDelete = true;
        isUpdate = false
      }

      // If there is a record, and the data in that record differs from recordData, update
      if (txt.length === 1 && txt[0]['data'] != recordData)
        isUpdate = true;

      // If there is no record, and the recordData is an empty string, don't do anything
      if (txt.length === 0 && recordData === '') {
        isUpdate = false;
        isDelete = false;
      }

      // If there is an update, there needs to be a delete first
      if (isUpdate === true) isDelete = true;

      // Delete existing records with matching record type and name
      if (isDelete) {
        txt.forEach((item, index) => {
          const urlDelete = url + item['id'];
          console.log(`DELETE ${urlDelete}`);
          fetch(urlDelete, { method: 'DELETE', headers: headers })
            .catch(function(error) {
              console.log(error);
            });
        });
      }

      // Create new DNS record if we are updating
      if (isUpdate) {

        const data = JSON.stringify({
          type: recordType,
          name: recordName,
          data: recordData,
          ttl: recordTtl
        });
        console.log(`POST ${url} with data ${data}`);
        return fetch(url, { method: 'POST', headers: headers, body: data });
      } else {
        return;
      }
    });
}
