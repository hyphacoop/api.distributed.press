const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');
const ipfsClient = require('ipfs-http-client')

// Application constants
const txtIpfs = '_dnslink.api';
const txtHypercore = 'api';

// Application configurations
const confFile = fs.readFileSync(`../data/config.json`);
const conf = JSON.parse(confFile);

// Runtime settings
const period = conf['dev']['pinningPeriod'] ? conf['dev']['pinningPeriod'] : '0 */10 * * * *'
const { globSource } = ipfsClient;
const ipfs = ipfsClient(conf['ipfsServer']);

// Run this job every 10 minutes by default
const job = new cron.CronJob(period, function() {
  conf['activeProjects'].forEach((project, index) => {
    let projFile = fs.readFileSync(`../data/${project}/config.json`);
    let proj = JSON.parse(projFile);
    let domain = proj['domain'];
    let doToken = proj['digitalOceanAccessToken'];

    // Pin API responses to Hypercore
    // updateDnsRecordDigitalOcean(domain, 'TXT', txtHypercore, `datkey=${hyperDriveKey}`, 300, doToken);

    // Pin API responses to IPFS
    ipfs.add(globSource(`../data/${project}/api`, { pin: true, recursive: true, timeout: 10000 }))
      .then(file => file['cid'].toV1().toString())
      .then(cid => {
        console.log(`API responses pinned at ipfs/${cid}`);

        // Update DNS record
        updateDnsRecordDigitalOcean(domain, 'TXT', txtIpfs, `dnslink=/ipfs/${cid}`, 300, doToken);
      })
      .catch(function(error) {
        console.log(error);
      });
  });
}, null, true);

function updateDnsRecordDigitalOcean(domain, recordType, recordName, recordData, recordTtl, doToken) {
   return new Promise((resolve, reject) => {
    // List existing DNS records for domain
    let url = `https://api.digitalocean.com/v2/domains/${domain}/records/`;
    let headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doToken}`
    };
    console.log(`GET ${url}`);
    fetch(url, { headers: headers })
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
        fetch(url, { method: 'POST', headers: headers, body: data })
          .catch(function(error) {
            console.log(error);
          });
      })
      .catch(function(error) {
        console.log(error);
      });
   });
}