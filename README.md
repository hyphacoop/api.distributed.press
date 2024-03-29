![logo-distributedpress](logo-distributedpress.png)

If you are new to the Distributed Press project, please visit our [project website](https://docs.distributed.press/) and [project wiki](https://github.com/hyphacoop/distributed-press-organizing/wiki/) for background context.

A Distributed Press server instance is provisioned with access to the World Wide Web (WWW) and Distributed Web (DWeb), and runs the Distributed Press API.
An instance can be provisioned [using this ansible](./ansibles/).

A project may use the Distributed Press API of this server to publish its website, and the server will:
- host the project website on WWW and seed it to DWeb networks (i.e. Hypercore, IPFS)
- serve the Distributed Press API on WWW and seed GET responses to the DWeb networks

The Distributed Press is in early development, and is currently used to publish the [COMPOST magazine](https://compost.digital).
The official instance of the Distributed Press API is hosted at [api.distributed.press](https://api.distributed.press).

## Developing

1. (Only once) Install dependencies: `npm i`
2. (Only once) Create an RSA keypair for signing JWTs: `npm run keygen`
3. To get the admin JWT that can be used to bootstrap other admin accounts, run `npm run make-admin`. This should only be used once to create actual admins (e.g. individuals in your organization who have the ability to add/edit publishers).
4. Running the server:
  1. Normal: `npm run dev`
  2. Watch for changes: `npm run watch`
5. Running tests: `npm test`

## Troubleshooting

Try nuking the cache and protocol configs by running `npm run nuke`. Note you will reset the history for all your domains.
