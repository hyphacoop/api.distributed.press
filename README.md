# Distributed Press API

A Distributed Press server instance is provisioned with access to the World Wide Web (WWW) and Decentralized Web (DWeb), and runs the Distributed Press API.
An instance can be provisioned [using this ansible](https://github.com/hyphacoop/ansibles/tree/master/distributed-press).

A project may use the Distributed Press API of this server to publish its website, and the server will:
- host the project website on WWW and seed it to DWeb networks (i.e. Hypercore, IPFS)
- serve the Distributed Press API on WWW and seed GET responses to the DWeb networks

The official instance of the Distributed Press API is hosted at [api.distributed.press](https://api.distributed.press).

## Architecture

```
    +-----------------------------------+
    | Data Store                        |    +--------------+
    +-----------------------------------+    | API          |
    | ./<project>/config.json           |    +--------------+
    |           ./api/v0/publication/*  |    | Publication  +----(GET/POST https://)--->
    |                  ./monetization/* +--->| Monetization |
    |                  ./identity/*     |    | Identity     +----(GET hyper://)-------->
    |                  ./content/*      |    | Content      +----(GET ipns://)--------->
    |                  ./social/*       |    | Social       |
    +--+-----------------------+--------+    +--------------+
       |  ^                    | 
  read |  |                    | API responses
  conf |  | write              | of GET requests 
       |  | resp               |
       v  |                    v
    +-----+---+      +------------------+
    | Backend |      | Pinning Services |
    +----+----+      +--+------------+--+
         |              |            |
         v              v            v
    third-party      Hypercore      IPFS
    integrations     network        network
```

## API Specifications

### Publication API

**Request:**

| Protocol         | Method | URL |
|:-----------------|:-------|:----|
| http             | `POST` | `https://<domain>/<project>/v0/publication/publish?apikey=API_KEY` |

TBA

### Monetization API

**Request:**

| Protocol         | Method | URL |
|:-----------------|:-------|:----|
| http             | `GET`  | `https://<domain>/<project>/v0/monetization/balances` |
| hyper            | `GET`  | `hyper://<key>/<project>/v0/monetization/balances`    |
| hyper-http proxy | `GET`  | `https://hyper.<domain>/<key>/v0/monetization/balances` |
| ipfs             | `GET`  | `ipns://<dnslink>/<project>/v0/monetization/balances` |
| ipfs-http proxy  | `GET`  | `https://ipfs.<domain>/ipns/<dnslink>/v0/monetization/balances` |

**Response:**

- `result`: an array of monetization endpoints
  - `name`: the name of the monetization endpoint defined in project config
  - `type`: the type of the monetization endpoint, supported values are `oc` (Open Collective), `eth` (Ethereum), and `erc20` (ERC20 tokens)
  - `balances`: a list of account balances associated with the monetization endpoint
    - `balance`: the balance as a string
    - `decimal`: the decimal places of the `balance`
    - `currency`: the currency of the `balance`
- `error`: the error message; or empty if the request succeeded
- `errorCode`: the error code as an integer; or `0` if the request succeeded

**Example:** https://api.distributed.press/compost/v0/monetization/balances

```
{
  "result": [
    {
      "name": "open-collective",
      "type": "oc",
      "balances": [
        {
          "balance": "1827105",
          "decimal": 2,
          "currency": "CAD"
        }
      ]
    },
    {
      "name": "gitcoin",
      "type": "eth",
      "balances": [
        {
          "balance": "0",
          "decimal": 6,
          "currency": "ETH"
        }
      ]
    },
    {
      "name": "gitcoin-erc20",
      "type": "erc20",
      "balances": [
        {
          "balance": "11065339",
          "decimal": 6,
          "currency": "DAI"
        },
        {
          "balance": "1565339",
          "decimal": 6,
          "currency": "CLR7"
        }
      ]
    }
  ],
  "error": "",
  "errorCode": 0
}
```
