const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');
const hyperPublisher = require('hyperdrive-publisher')
const ipfsClient = require('ipfs-http-client')

// Application constants
const txtIpfs = '_dnslink.api';
const txtHypercore = 'api';

// Application configurations
const confFile = fs.readFileSync(`../data/config.json`);
const conf = JSON.parse(confFile);

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
  conf['activeProjects'].forEach((project, index) => {
    try {
      let projFile = fs.readFileSync(`../data/${project}/config.json`);
      let proj = JSON.parse(projFile);
      let domain = proj['domain'];
      let dir = `../data/${project}/api`;

      // Pin API responses to Hypercore
      getDatSeed(project, domain)
        .then(seed => hyperPublisher.sync({
          seed,
          fsPath: dir,
          drivePath: '/'
        }))
        .then(({diff, url}) => {
          // Log any changes to hyperdrive and return url
          console.log(`API responses for ${project} pinned at ${url}. Changes:`);
          console.log(diff);
          return url;
        })
        .catch(function(error) {
          console.log(error);
        });

      // Pin API responses to IPFS
      ipfs.add(globSource(dir, { pin: true, recursive: true, timeout: 10000 }))
        .then(file => file['cid'].toV1().toString())
        .then(cid => {
          console.log(`API responses for ${project} pinned at ipfs/${cid}`);

          // Update DNS record
          return updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfs, `dnslink=/ipfs/${cid}`, 300, conf['digitalOceanAccessToken']);
        })
        .catch(function(error) {
          console.log(error);
        });
    } catch (error) {
      console.log(error);
    }
  });
}, null, true);

async function getDatSeed(project, domain) {
  // Read private dat-seed
  let dirPrivate = `../data/${project}/private`
  let seed;
  try {
    seed = fs.readFileSync(`${dirPrivate}/dat-seed`);
  } catch (error) {
    console.log('Project dat-seed not found');
  }
  // If no dat-seed is stored, generate new dat-seed and publish hyperdrive
  if (seed === undefined) {
    // Generate new dat-seed
    console.log(`Generating new dat-seed ...`);
    seed = require('crypto').randomBytes(32);

    // Store new dat-seed in private directory of project
    if (!fs.existsSync(dirPrivate)) {
      fs.mkdirSync(dirPrivate, { recursive: true });
    }
    fs.writeFileSync(`${dirPrivate}/dat-seed`, seed);
    console.log(`Project dat-seed updated for ${project}`);

    // Publish hyperdrive to dat-store with new seed
    await hyperPublisher.getURL({seed})
      .then(url => datStoreClient.add(url))
      .then(() => hyperPublisher.create({seed}))
      .then(({url}) => {
          console.log(`New hyperdrive published for ${project}`);

          // Update DNS record
          let hyperdriveKey = url.replace('hyper://', '');
          return updateDnsRecordDigitalOcean(domain, 'TXT', txtHypercore, `datkey=${hyperdriveKey}`, 300, conf['digitalOceanAccessToken']);
        });
  }
  if (seed === undefined) {
    throw new Error('Failed to get dat-seed');
  } else {
    return seed;
  }
}

function updateDnsRecordDigitalOcean(domain, recordType, recordName, recordData, recordTtl, doToken) {
  // List existing DNS records for domain
  let url = `https://api.digitalocean.com/v2/domains/${domain}/records/`;
  let headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${doToken}`
  };
  console.log(`GET ${url}`);
  return fetch(url, { headers: headers })
    .then(res => res.json())
    .then(json => json['domain_records'].filter(record => record['type'] === recordType && record['name'] === recordName))
    .then(txt => {
      // Delete existing records with matching record type and name
      txt.forEach((item, index) => {
        let urlDelete = url + item['id'];
        console.log(`DELETE ${urlDelete}`);
        fetch(urlDelete, { method: 'DELETE', headers: headers })
          .catch(function(error) {
            console.log(error);
          });
      });

      // Create new DNS record
      data = JSON.stringify({
        type: recordType,
        name: recordName,
        data: recordData,
        ttl:  recordTtl
      });
      console.log(`POST ${url} with data ${data}`);
      return fetch(url, { method: 'POST', headers: headers, body: data });
    });
}