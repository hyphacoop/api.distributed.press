const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');
const hyperPublisher = require('hyperdrive-publisher')
const ipfsClient = require('ipfs-http-client')

// Application constants
const txtHypercoreWww = '@';
const txtHypercoreApi = 'api';
const txtIpfsWww = '_dnslink';
const txtIpfsApi = '_dnslink.api';

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
      let dirWww = `../data/${project}/www`;
      let dirApi = `../data/${project}/api`;

      // Pin WWW site to Hypercore
      getDatSeed('dat-seed-www', project, domain, txtHypercoreWww)
        .then(seed => hyperPublisher.sync({
          seed,
          fsPath: dirWww,
          drivePath: '/',
          syncTime: 600000 // Allow up to 10 minutes for sync
        }))
        .then(({diff, url}) => {
          // Log any changes to hyperdrive and return url
          console.log(`WWW site for ${project} pinned at ${url}. Changes:`);
          console.log(diff);
          return url;
        })
        .catch(function(error) {
          console.log(error);
        });

      // Pin WWW site to IPFS
      ipfs.add(globSource(dirWww, { pin: true, recursive: true, timeout: 10000 }))
        .then(file => file['cid'].toV1().toString())
        .then(cid => {
          console.log(`WWW site for ${project} pinned at ipfs/${cid}`);

          // Update DNS record
          return updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfsWww, `dnslink=/ipfs/${cid}`, 300, conf['digitalOceanAccessToken']);
        })
        .catch(function(error) {
          console.log(error);
        });

      // Pin API responses to Hypercore
      getDatSeed('dat-seed-api', project, domain, txtHypercoreApi)
        .then(seed => hyperPublisher.sync({
          seed,
          fsPath: dirApi,
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
      ipfs.add(globSource(dirApi, { pin: true, recursive: true, timeout: 10000 }))
        .then(file => file['cid'].toV1().toString())
        .then(cid => {
          console.log(`API responses for ${project} pinned at ipfs/${cid}`);

          // Update DNS record
          return updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfsApi, `dnslink=/ipfs/${cid}`, 300, conf['digitalOceanAccessToken']);
        })
        .catch(function(error) {
          console.log(error);
        });
    } catch (error) {
      console.log(error);
    }
  });
}, null, true);

async function getDatSeed(datSeedName, project, domain, recordName) {
  // Read private Dat seed
  let dirPrivate = `../data/${project}/private`
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
    console.log(`Project ${datSeedName} updated for ${project}`);

    // Publish hyperdrive to dat-store with new seed
    await hyperPublisher.getURL({seed})
      .then(url => datStoreClient.add(url))
      .then(() => hyperPublisher.create({seed}))
      .then(({url}) => {
          console.log(`New hyperdrive published for ${project}`);

          // Update DNS record
          let hyperdriveKey = url.replace('hyper://', '');
          return updateDnsRecordDigitalOcean(domain, 'TXT', recordName, `datkey=${hyperdriveKey}`, 300, conf['digitalOceanAccessToken']);
        });
  }
  if (seed === undefined) {
    throw new Error(`Failed to get ${datSeedName}`);
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