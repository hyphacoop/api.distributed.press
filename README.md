# Distributed Press API

If you are new to the Distributed Press project, please visit our [project website](https://distributed.press) and [project wiki](https://github.com/hyphacoop/distributed-press-organizing/wiki/) for background context.

A Distributed Press server instance is provisioned with access to the World Wide Web (WWW) and Decentralized Web (DWeb), and runs the Distributed Press API.
An instance can be provisioned [using this ansible](https://github.com/hyphacoop/ansibles/tree/master/distributed-press).

A project may use the Distributed Press API of this server to publish its website, and the server will:
- host the project website on WWW and seed it to DWeb networks (i.e. Hypercore, IPFS)
- serve the Distributed Press API on WWW and seed GET responses to the DWeb networks

The Distributed Press is in early development, and is currently used to publish the [COMPOST magazine](https://compost.digital).
The official instance of the Distributed Press API is hosted at [api.distributed.press](https://api.distributed.press).

## Guide

This guide describes how to use the Distributed Press to publish your website content and the Distributed Press API for your project.
After these steps, you will find your website at your domain name with these WWW and DWeb URLs:

| Protocol    | URL                      | Example |
|:------------|:-------------------------|:--------|
| HTTP        |`https://<project.domain>`| [https://staging.compost.digital](https://staging.compost.digital) |
| Hypercore   |`hyper://<project.domain>`| [hyper://staging.compost.digital](https://hyper.distributed.press/staging.compost.digital/) |
| IPFS / IPNS |`ipns://<project.domain>` | [ipns://staging.compost.digital](https://ipfs.distributed.press/ipns/staging.compost.digital/) |

Your project APIs will be served at:

| Protocol    | URL                          | Example |
|:------------|:-----------------------------|:--------|
| HTTP        |`https://api.<project.domain>`| [https://api.staging.compost.digital/v0/monetization/balances.json](https://api.staging.compost.digital/v0/monetization/balances.json) |
| Hypercore   |`hyper://api.<project.domain>`| [hyper://api.staging.compost.digital/v0/monetization/balances.json](https://hyper.distributed.press/api.staging.compost.digital/v0/monetization/balances.json) |
| IPFS / IPNS |`ipns://api.<project.domain>` | [ipns://api.staging.compost.digital/v0/monetization/balances.json](https://ipfs.distributed.press/ipns/api.staging.compost.digital/v0/monetization/balances.json) |

### Steps

1. We use [Digital Ocean](https://digitalocean.com) to manage domain name records.
    From your domain name registrar, point name servers to Digital Ocean's name servers:
    ```
    ns1.digitalocean.com
    ns2.digitalocean.com
    ns3.digitalocean.com
    ```

2. Add an API key, `PROJECT_API_KEY`, for your domain on the Distributed Press server.
    During our current pre-release phase, this is done via an internal API.
    Please file a GitHub issue to request an API key from our administrators.

    If you are running your own instance, you can create one using this internal API:
    ```
    $ curl -v -X POST http://localhost:3030/v0/internal/addApiKey?project=<project.domain>
    ```

3. Configure your project using the [`configure`](./#configure) API:
    ```
    $ curl -v https://api.distributed.press/v0/publication/configure -H "Content-Type: multipart/form-data" -H "Accept: application/json" -H "Authorization: Bearer ${PROJECT_API_KEY}" -F "file=@config.json"
    ```

    If you only want to publish the website content, the `config.json` file is simply:
    ```
    {
      "domain": "<project.domain>",
    }
    ```

    See the [`configure` API spec](./#configure) if you want to enable project API features.

4. Publish your website content using the [`publish`](./#publish) API:
    ``` 
    $ curl -v https://api.distributed.press/v0/publication/publish -H "Content-Type: multipart/form-data" -H "Accept: application/json" -H "Authorization: Bearer ${PROJECT_API_KEY}" -F "file=@www.tar.gz"
    ```

    The website to publish is a `tar.gz` archive created using `tar -czvf www.tar.gz -C www .`.

## Project List

This is the list of projects published using the Distributed Press.

| Domain                  | Description |
|:------------------------|:------------|
| staging.compost.digital | Example website for Distributed Press |
| compost.digital         | COMPOST magazine |

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
    |           ./www/*                 |    +--------------+-------------+
    +-----------------------------------+
       ^  ^                    ^
       |  |                    |
  read |  | write              | read API responses
  conf |  | responses          | of GET requests 
       |  |                    |
    +--+--+---+      +---------+--------+
    | Backend |      | Pinning Services +---> DNS updates
    +----+----+      +--+------------+--+     (domain for WWW)
         |              |            |        (dnslink for IPFS)
         v              v            v
    third-party      Hypercore      IPFS
    integrations     network        network
```

## API Specifications

### Publication API

#### `configure`

**Request:**

| Protocol | Method | URL |
|:---------|:-------|:----|
| HTTP     | `POST` | `https://<server.domain>/v0/publication/configure` |

POST headers:
- `Authorization: Bearer PROJECT_API_KEY`, where `PROJECT_API_KEY` is the project API key to authenticate with the Distributed Press server

POST request body:
- `domain`: the project domain (this must be the domain associated with the project API key)
- `monetization`: configurations for the Monetization API
  - `accounts`: an array of monetization accounts for the project
    - `name`: the name of the monetization account
    - `type`: the type of the monetization account, supported values are `oc` (Open Collective), `eth` (Ethereum), and `erc20` (ERC20 tokens)
    - `id`: the identifier of the monetization account, for `oc` this is the name of the Collective, and for `eth` and `erc20` this is the Ethereum address
  - `currency`: the base currency of the project, see [supported currencies](https://api.coinbase.com/v2/currencies)

**Response:**

HTTP response code, one of:
- `201` Created: the new configuration is enabled
- `400` Bad Request: the request contains missing or invalid data
- `401` Unauthorized: the `PROJECT_API_KEY` is missing or invalid
- `500` Internal Server Error: the request failed due to a server error
- `503` Service Unavailable: the service is temporarily unavailable

**Example:**

| Protocol       | Method | URL |
|:---------------|:-------|:----|
| HTTP           | `POST` | `https://api.distributed.press/v0/publication/configure` |

POST headers:
- `Authorization: Bearer STAGING_COMPOST_DIGITAL_API_KEY`

POST request body:
```
{
  "domain": "staging.compost.digital",
  "monetization": {
    "accounts": [
      {
        "name": "open-collective",
        "type": "oc",
        "id": "compost"
      },
      {
        "name": "gitcoin",
        "type": "eth",
        "id": "0xfb6F8D5DD687E77Aa9275a1Cb397dA3c23aAf342"
      },
      {
        "name": "gitcoin-erc20",
        "type": "erc20",
        "id": "0xfb6F8D5DD687E77Aa9275a1Cb397dA3c23aAf342"
      }
    ],
    "currency": "CAD"
  }
}
```

#### `publish`

**Request:**

| Protocol | Method | URL |
|:---------|:-------|:----|
| HTTP     | `POST` | `https://<server.domain>/v0/publication/publish` |

POST headers:
- `Authorization: Bearer PROJECT_API_KEY`, where `PROJECT_API_KEY` is the project API key to authenticate with the Distributed Press server

POST request body: the website to publish, as a `tar.gz` archive created using `tar -czvf www.tar.gz -C www .`

**Response:**

HTTP response code, one of:
- `202` Accepted: the website archive is uploaded and will be published asynchronously
- `400` Bad Request: the request contains missing or invalid data
- `401` Unauthorized: the `PROJECT_API_KEY` is missing or invalid
- `500` Internal Server Error: the request failed due to a server error
- `503` Service Unavailable: the service is temporarily unavailable

**Example:**

| Protocol       | Method | URL |
|:---------------|:-------|:----|
| HTTP           | `POST` | `https://api.distributed.press/v0/publication/publish` |

POST headers:
- `Authorization: Bearer STAGING_COMPOST_DIGITAL_API_KEY`

POST request body: (see sources for `staging.compost.digital` at [hyphacoop/compost.digital](https://github.com/hyphacoop/compost.digital/))

Published project website in this example is available at:

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
| HTTP           | `GET`  | `https://api.<project.domain>/v0/monetization/balances.json` |
| Hypercore      | `GET`  | `hyper://api.<project.domain>/v0/monetization/balances.json` |
| IPFS / IPNS    | `GET`  | `ipns://api.<project.domain>/v0/monetization/balances.json` |
| **HTTP proxy** |
| Hypercore      | `GET`  | `https://hyper.<server.domain>/api.<project.domain>/v0/monetization/balances.json` |
| IPFS / IPNS    | `GET`  | `https://ipfs.<server.domain>/ipns/api.<project.domain>/v0/monetization/balances.json` |

**Response:**

- `accounts`: an array of monetization accounts
  - `name`: the name of the monetization account defined in project config
  - `type`: the type of the monetization account, supported values are `oc` (Open Collective), `eth` (Ethereum), and `erc20` (ERC20 tokens)
  - `balances`: a list of account balances associated with the monetization account
    - `balance`: the balance as a string
    - `decimal`: the decimal places of the `balance`
    - `currency`: the currency of the `balance`
- `balance`: the total estimated balance across all accounts converted to the currency defined in project config using [Coinbase exchange rates](https://developers.coinbase.com/api/v2#exchange-rates)
- `decimal`: the decimal places of the total estimated balance
- `currency`: the currency defined in project config, see [supported currencies](https://api.coinbase.com/v2/currencies)
- `error`: the error message; or empty if the request succeeded
- `errorCode`: the error code as an integer; or `0` if the request succeeded

**Example:**

| Protocol       | Method | URL |
|:---------------|:-------|:----|
| HTTP           | `GET`  | https://api.staging.compost.digital/v0/monetization/balances.json |
| Hypercore      | `GET`  | hyper://api.staging.compost.digital/v0/monetization/balances.json |
| IPFS / IPNS    | `GET`  | ipns://api.staging.compost.digital/v0/monetization/balances.json |
| **HTTP proxy** |
| Hypercore      | `GET`  | https://hyper.distributed.press/api.staging.compost.digital/v0/monetization/balances.json |
| IPFS / IPNS    | `GET`  | https://ipfs.distributed.press/ipns/api.staging.compost.digital/v0/monetization/balances.json |

<details>
<summary>Result</summary>
<pre>
{
  "accounts": [
    {
      "name": "open-collective",
      "type": "oc",
      "balances": [
        {
          "balance": "1827535",
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
  "balance": "1828939",
  "decimal": 2,
  "currency": "CAD",
  "error": "",
  "errorCode": 0,
  "timestamp": "2021-01-08T05:23:25.457Z"
}
</pre>
</details>
