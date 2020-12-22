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
    | Data Store                        |    +--------------+-------------+
    +-----------------------------------+    | API          | HTTP server | <--- GET/POST/DELETE
    | ./<project>/config.json           |    +--------------+-------------+      https://
    |           ./api/v0/publication/*  |    | Publication  | Hypercore   |
    |                  ./monetization/* +--->| Monetization | network     | <--- GET hyper://
    |                  ./identity/*     |    | Identity     +-------------+
    |                  ./content/*      |    | Content      | IPFS        |
    |                  ./social/*       |    | Social       | network     | <--- GET ipns://
    +--+-----------------------+--------+    +--------------+-------------+
       |  ^                    | 
  read |  |                    | API responses
  conf |  | write              | of GET requests 
       |  | resp               |
       v  |                    v
    +-----+---+      +------------------+
    | Backend |      | Pinning Services +---> DNS updates
    +----+----+      +--+------------+--+     (domain for WWW)
         |              |            |        (dnslink for IPFS)
         v              v            v
    third-party      Hypercore      IPFS
    integrations     network        network
```

## API Specifications

### Publication API

#### `publish`

**Request:**

| Protocol | Method | URL |
|:---------|:-------|:----|
| HTTP     | `POST` | `https://<server.domain>/<project>/v0/publication/publish?apikey=API_KEY` |

TBA

**Example:** https://api.distributed.press/compost/v0/publication/publish?apikey=API_KEY

Website available at:

| Protocol       | Method | URL |
|:---------------|:-------|:----|
| HTTP           | `GET`  | https://staging.compost.digital |
| Hypercore      | `GET`  | hyper://staging.compost.digital |
| IPFS / IPNS    | `GET`  | ipns://staging.compost.digital |
| **HTTP proxy** |
| Hypercore      | `GET`  | https://hyper.distributed.press/staging.compost.digital/ |
| IPFS / IPNS    | `GET`  | https://ipfs.distributed.press/ipns/staging.compost.digital/ |

### Monetization API

#### `balances`

**Request:**

| Protocol       | Method | URL |
|:---------------|:-------|:----|
| HTTP           | `GET`  | `https://<server.domain>/<project>/v0/monetization/balances.json` |
| Hypercore      | `GET`  | `hyper://api.<project.domain>/v0/monetization/balances.json`    |
| IPFS / IPNS    | `GET`  | `ipns://api.<project.domain>/v0/monetization/balances.json` |
| **HTTP proxy** |
| Hypercore      | `GET`  | `https://hyper.<server.domain>/api.<project.domain>/v0/monetization/balances.json` |
| IPFS / IPNS    | `GET`  | `https://ipfs.<server.domain>/ipns/api.<project.domain>/v0/monetization/balances.json` |

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

**Example:**

| Protocol       | Method | URL |
|:---------------|:-------|:----|
| HTTP           | `GET`  | https://api.distributed.press/compost/v0/monetization/balances.json |
| Hypercore      | `GET`  | hyper://api.staging.compost.digital/v0/monetization/balances.json |
| IPFS / IPNS    | `GET`  | ipns://api.staging.compost.digital/v0/monetization/balances.json |
| **HTTP proxy** |
| Hypercore      | `GET`  | https://hyper.distributed.press/api.staging.compost.digital/v0/monetization/balances.json |
| IPFS / IPNS    | `GET`  | https://ipfs.distributed.press/ipns/api.staging.compost.digital/v0/monetization/balances.json |

<details>
<summary>Result</summary>
<pre>
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
</pre>
</details>
