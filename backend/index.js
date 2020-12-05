const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');

const apiVersion = 'v0';
let confFile = fs.readFileSync(`../data/config.json`);
let conf = JSON.parse(confFile);

// Run this job every minute
const job = new cron.CronJob(`*/${conf['refreshPeriod']} * * * * *`, function() {
  conf['activeProjects'].forEach(function(project, index) {
    let projFile = fs.readFileSync(`../data/${project}/config.json`);
    let proj = JSON.parse(projFile);

    // Query monetization account balances
    fetchPromises = [];
    proj['monetization'].forEach(function(item, index) {
      switch (item['type']) {
        case 'oc':
          url = `https://opencollective.com/${item['account']}.json`;
          console.log(`Fetching from remote ${url}`);
          fetchPromises.push(fetch(url)
            .then(res => res.json())
            .then(json => {
              return {
                name: item['name'],
                type: item['type'],
                balance: json['balance'],
                currency: 'CAD'
              }
            })
            .catch(function(error) {
              console.log(error);
            }));
          break;
        case 'eth':
          url = `https://api.etherscan.io/api?module=account&action=balance&address=${item['account']}&tag=latest&apikey=${conf['etherscanApikey']}`;
          console.log(`Fetching from remote ${url}`);
          fetchPromises.push(fetch(url)
            .then(res => res.json())
            .then(json => {
              if (json['status'] !== '1') throw new Error(`Failed to fetch from remote ${url}`);
              return {
                name: item['name'],
                type: item['type'],
                balance: json['result'], 
                currency: 'ETH'
              }
            })
            .catch(function(error) {
              console.log(error);
            }));
          break;
        default:
          throw err;
      };
    });

    Promise.all(fetchPromises).then(values => {
      // Write account balances to file
      const balances = JSON.stringify({ 'balances': values.filter(x => x) });
      const dir = `../data/${project}/api/${apiVersion}/monetization/`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFile(`${dir}/balances.json`, balances, (err) => {
        if (err) {
          throw err;
        }
        console.log(`balances.json updated for ${project}`);
      });
    });
  });
}, null, true);
