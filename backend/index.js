const cron = require('cron');
const fetch = require('node-fetch');
const fs = require('fs');

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
  // Initialize configuration and data directory if they do not exist
  if (!fs.existsSync(confFile)) {
    if (!fs.existsSync(confDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.copyFileSync('config.template.json', confFile, fs.constants.COPYFILE_EXCL);
    console.log(`Set up application configuration at ${confFile}`);
    process.exit(1);
  }

  // Initialize empty project list if one does not exist
  if (!fs.existsSync(projFile)) {
    fs.copyFileSync('projects.template.json', projFile, fs.constants.COPYFILE_EXCL);
    console.log(`Created empty project list at ${projFile}`);
  }

  // Read application configurations
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

  // Initialize empty projects directory if one does not exist
  if (!fs.existsSync(projDir)) {
    fs.mkdirSync(projDir, { recursive: true });
    console.log(`Created empty projects directory at ${projDir}`);
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
        let url = '';

        // Query monetization account balances
        fetchPromises = [];
        proj['monetization']['accounts'].forEach((item, index) => {
          switch (item['type']) {
            case 'oc':
              // Fetch Open Collective balance
              url = `https://opencollective.com/${item['id']}.json`;
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
              url = `https://api.etherscan.io/api?module=account&action=balance&address=${item['id']}&tag=latest&apikey=${conf['etherscanApiKey']}`;
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
              url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${item['id']}&startblock=0&endblock=999999999&sort=asc&apikey=${conf['etherscanApiKey']}`;
              console.log(`GET ${url}`);
              fetchPromises.push(fetch(url)
                .then(res => res.json())
                .then(json => {
                  if (json['status'] !== '1') throw new Error(`Failed to fetch from remote ${url}`);
                  const tokenMap = new Map();
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
                      if (equalsIgnoreCase(tx['from'], item['id'])) value = -value;

                      // Add transaction to map
                      if (tokenMap.has(tx['tokenSymbol'])) {
                        const tokenBalance = tokenMap.get(tx['tokenSymbol']);
                        if (tokenBalance['tokenDecimal'] !== tokenDecimal) throw new Error(`The token ${tokenSymbol} has transactions with different tokenDecimal`);
                        const cumulativeValue = tokenBalance['value'] + value;
                        tokenMap.set(tx['tokenSymbol'], { 'value': cumulativeValue, 'tokenDecimal': tokenDecimal });
                      } else {
                        tokenMap.set(tx['tokenSymbol'], { 'value': value, 'tokenDecimal': tokenDecimal });
                      }
                    }
                  });

                  // Format result from tokenMap
                  const result = {
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
                  const balStr = b['balance'];
                  const decInt = b['decimal'];
                  const balFlt = parseFloat(`${balStr.slice(0, balStr.length - decInt)}.${balStr.slice(balStr.length - decInt, balStr.length)}`);
                  const exrFlt = parseFloat(rates[b['currency']]); // This loses some precision
                  if (balFlt && exrFlt) {
                    // Add to total estimated balance
                    totalBalance += balFlt / exrFlt;
                  }
                });
              });

              // Crop total estimated balance to 2-decimal precision
              const decIndex = totalBalance.toString().indexOf('.');
              let balance = totalBalance.toString().replace('.','');
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
              const dir = `${projDir}/${projName}/api/${apiVersion}/monetization`;
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFile(`${dir}/balances.json`, balances, (err) => {
                if (err) {
                  throw err;
                }
                console.log(`balances.json updated for ${projName}`);
              });
              return balances;
            });
        });
      } catch (error) {
        console.log(error);
      }
    });
  } catch (error) {
    console.log(error);
  }
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


