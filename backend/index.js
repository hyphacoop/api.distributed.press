const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');

// Application constants
const apiVersion = 'v0';
const confDir = `${require('os').homedir()}/.distributed-press`;
const confFile = `${confDir}/config.json`;

// Application configurations
let dataDir = `${confDir}/data`;
let conf;
try {
  // Initialize configuration and data directory if they do not exist
  if (!fs.existsSync(confFile)) {
    if (!fs.existsSync(confDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.copyFileSync('config.template.json', confFile, fs.constants.COPYFILE_EXCL);
    console.log(`Set up application configuration at ${confFile}`);
    process.exit(1);
  }

  // Read application configurations
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

  console.log(`Backend server started with configuration at ${confFile}`);
  console.log(`Data directory located at ${dataDir}`);
} catch (error) {
  console.log(error);
  process.exit(1);
}

// Runtime settings
const period = conf['dev']['refreshPeriod'] ? conf['dev']['refreshPeriod'] : '0 * * * * *'

// Run this job every minute by default
const job = new cron.CronJob(period, function() {
  conf['activeProjects'].forEach((project, index) => {
    try {
      let projFile = fs.readFileSync(`${dataDir}/${project}/config.json`);
      let proj = JSON.parse(projFile);
      let url = '';

      // Query monetization account balances
      fetchPromises = [];
      proj['monetization']['accounts'].forEach((item, index) => {
        switch (item['type']) {
          case 'oc':
            // Fetch Open Collective balance
            url = `https://opencollective.com/${item['account']}.json`;
            console.log(`GET ${url}`);
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
            url = `https://api.etherscan.io/api?module=account&action=balance&address=${item['account']}&tag=latest&apikey=${conf['etherscanApiKey']}`;
            console.log(`GET ${url}`);
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
            url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${item['account']}&startblock=0&endblock=999999999&sort=asc&apikey=${conf['etherscanApiKey']}`;
            console.log(`GET ${url}`);
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
        const projCurrency = proj['monetization']['currency'];
        const url = `https://api.coinbase.com/v2/exchange-rates?currency=${projCurrency}`;
        console.log(`GET ${url}`);
        fetch(url)
          .then(res => res.json())
          .then(json => {
            // Fetch exchange rates based on project currency
            if (json['data'] && json['data']['currency'] === projCurrency) {
              return json['data']['rates'];
            }
            return {};
          })
          .then(rates => {
            let totalBalance = 0;
            const accounts = values.filter(x => x); // Filter out results that are 'undefined'
            accounts.forEach((a, ai) => {
              a['balances'].forEach((b, bi) => {
                // Convert each account balance to project currency
                let balStr = b['balance'];
                let decInt = b['decimal'];
                let balFlt = parseFloat(`${balStr.slice(0, balStr.length - decInt)}.${balStr.slice(balStr.length - decInt, balStr.length)}`);
                let exrFlt = parseFloat(rates[b['currency']]); // This loses some precision
                if (balFlt && exrFlt) {
                  // Add to total estimated balance
                  totalBalance += balFlt / exrFlt;
                }
              });
            });

            // Crop total estimated balance to 2-decimal precision
            let balance = totalBalance.toString().replace('.','');
            let decIndex = totalBalance.toString().indexOf('.');
            let decimal = 0;
            if (decIndex > 0) {
              decimal = 2;
              balance = cropPrecision(balance, balance.length - (decIndex + decimal));
            }
            
            // Write total estimated and account balances to file
            const balances = JSON.stringify({
              accounts: values.filter(x => x),
              balance: balance,
              decimal: 2,
              currency: projCurrency,
              error: '',
              errorCode: 0,
              timestamp: new Date().toJSON() });
            const dir = `${dataDir}/${project}/api/${apiVersion}/monetization`;
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFile(`${dir}/balances.json`, balances, (err) => {
              if (err) {
                throw err;
              }
              console.log(`balances.json updated for ${project}`);
            });
            return balances;
          });
      });
    } catch (error) {
      console.log(error);
    }
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


