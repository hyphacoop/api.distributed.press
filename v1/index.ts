import apiBuilder from './api/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { IPFSProvider, Builtin } from './protocols/ipfs.js'
const paths = envPaths('distributed-press')

const argv = yargs(hideBin(process.argv)).options({
  port: { type: 'number' },
  host: { type: 'string' },
  data: { type: 'string' },
  ipfsProvider: { type: 'string' }
}).parseSync()

export interface ServerI {
  port: number
  host: string
  storage: string
  ipfsProvider: IPFSProvider
  dns: {
    server: string
    domains: string[]
  }
}

const cfg: ServerI = {
  port: Number(argv.port ?? process.env.PORT ?? '8080'),
  host: argv.host ?? process.env.HOST ?? 'localhost',
  storage: argv.data ?? paths.data,
  ipfsProvider: (argv.ipfsProvider as IPFSProvider) ?? Builtin,
  dns: {
    server: '127.0.0.1:53',
    domains: []
  }
}

const server = await apiBuilder({ ...cfg, useLogging: true, useSwagger: true, usePrometheus: true })
server.listen(cfg, (err, _address) => {
  if (err != null) {
    server.log.error(err)
    process.exit(1)
  }
})
