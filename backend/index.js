const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');

const apiVersion = 'v0';
let confFile = fs.readFileSync(`../data/config.json`);
let conf = JSON.parse(confFile);

// Run this job every minute
const job = new cron.CronJob(`*/${conf['refreshPeriod']} * * * * *`, function() {
  conf['activeProjects'].forEach((project, index) => {
    let projFile = fs.readFileSync(`../data/${project}/config.json`);
    let proj = JSON.parse(projFile);
    let url = '';

    // Query monetization account balances
    fetchPromises = [];
    proj['monetization'].forEach((item, index) => {
      switch (item['type']) {
        case 'oc':
          // Fetch Open Collective balance
          url = `https://opencollective.com/${item['account']}.json`;
          console.log(`Fetching from remote ${url}`);
          fetchPromises.push(fetch(url)
            .then(res => res.json())
            .then(json => {
              return {
                name: item['name'],
                type: item['type'],
                balances: [
                  {
                    balance: json['balance'].toString(),
                    decimal: 2,
                    currency: 'CAD'
                  }
                ]
              }
            })
            .catch(function(error) {
              console.log(error);
            }));
          break;
        case 'eth':
          // Fetch Ethereum address ETH balance
          url = `https://api.etherscan.io/api?module=account&action=balance&address=${item['account']}&tag=latest&apikey=${conf['etherscanApikey']}`;
          console.log(`Fetching from remote ${url}`);
          fetchPromises.push(fetch(url)
            .then(res => res.json())
            .then(json => {
              if (json['status'] !== '1') throw new Error(`Failed to fetch from remote ${url}`);
              return {
                name: item['name'],
                type: item['type'],
                balances: [
                  {
                    balance: cropPrecision(json['result'], 12),
                    decimal: 6,
                    currency: 'ETH'
                  }
                ]
              }
            })
            .catch(function(error) {
              console.log(error);
            }));
          break;
        case 'erc20':
          // Fetch Ethereum address ERC20 balances
          url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${item['account']}&startblock=0&endblock=999999999&sort=asc&apikey=${conf['etherscanApikey']}`;
          console.log(`Fetching from remote ${url}`);
          fetchPromises.push(fetch(url)
            .then(res => res.json())
            .then(json => {
              if (json['status'] !== '1') throw new Error(`Failed to fetch from remote ${url}`);
              let tokenMap = new Map();
              json['result'].forEach((tx, index) => {
                if (tx['confirmations'] > 6) {
                  let value = 0;
                  let tokenDecimal = Number(tx['tokenDecimal']);

                  // Crop to a max of 6-decimal precision
                  if (tx['tokenDecimal'] > 6) {
                    value = Number(cropPrecision(tx['value'], tokenDecimal - 6));
                    tokenDecimal = 6;
                  } else {
                    value = Number(tx['value']);
                  }

                  // Make value negative if paid out from account
                  if (equalsIgnoreCase(tx['from'], item['account'])) value = -value;

                  // Add transaction to map
                  if (tokenMap.has(tx['tokenSymbol'])) {
                    let tokenBalance = tokenMap.get(tx['tokenSymbol']);
                    if (tokenBalance['tokenDecimal'] !== tokenDecimal) throw new Error(`The token ${tokenSymbol} has transactions with different tokenDecimal`);
                    let cumulativeValue = tokenBalance['value'] + value;
                    tokenMap.set(tx['tokenSymbol'], { 'value': cumulativeValue, 'tokenDecimal': tokenDecimal });
                  } else {
                    tokenMap.set(tx['tokenSymbol'], { 'value': value, 'tokenDecimal': tokenDecimal });
                  }
                }
              });

              // Format result from tokenMap
              let result = {
                name: item['name'],
                type: item['type'],
                balances: []
              };
              tokenMap.forEach((mapValue, mapKey, map) => {
                result['balances'].push({ balance: mapValue['value'].toString(), decimal: mapValue['tokenDecimal'], currency: mapKey });
              });
              return result;
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
      const balances = JSON.stringify({ 'result': values.filter(x => x), 'error': '', 'errorCode': 0 });
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

// Crop precision digits from number string
function cropPrecision(value, precision) {
  if (value !== undefined) {
    if (value.length <= precision) return value;
    return value.slice(0, value.length - precision);
  }
}

// Check if two strings are equal ignoring case
function equalsIgnoreCase(str, otherStr) {
  if (str !== undefined) {
    return str.localeCompare(otherStr, undefined, { sensitivity: 'base' }) === 0;
  }
  return otherStr === undefined;
}


