![logo-distributedpress](logo-distributedpress.png)

## v1

If you are new to the Distributed Press project, please visit our [project website](https://distributed.press) and [project wiki](https://github.com/hyphacoop/distributed-press-organizing/wiki/) for background context.

A Distributed Press server instance is provisioned with access to the World Wide Web (WWW) and Decentralized Web (DWeb), and runs the Distributed Press API.
An instance can be provisioned [using this ansible](https://github.com/hyphacoop/ansibles/tree/master/distributed-press).

A project may use the Distributed Press API of this server to publish its website, and the server will:
- host the project website on WWW and seed it to DWeb networks (i.e. Hypercore, IPFS)
- serve the Distributed Press API on WWW and seed GET responses to the DWeb networks

The Distributed Press is in early development, and is currently used to publish the [COMPOST magazine](https://compost.digital).
The official instance of the Distributed Press API is hosted at [api.distributed.press](https://api.distributed.press).

> Please check [v0/README.md](./v0/README.md) for the v0 documentation

## Developing
All necessary files are in `v1`. The commands in the following section will assume your current working directory is in the `v1` folder.

1. (Only once) Install dependencies: `npm i`
2. Running the development server:
  1. Normal: `npm run dev`
  1. Watch for changes: `npm run watch`
3. Running tests: `npm test`
4. Creating and running a production build: `npm run build && npm run start`

## Generating Clients
Swagger specs are OASv2 compliant. Use `swagger-codegen-cli` to generate appropriate client implementations
