import apiBuilder from './api/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { IPFSProvider, BUILTIN } from './protocols/ipfs.js'
const paths = envPaths('distributed-press')

const argv = yargs(hideBin(process.argv)).options({
  port: { type: 'number' },
  dnsport: { type: 'number' },
  host: { type: 'string' },
  data: { type: 'string' },
  ipfsProvider: { type: 'string' }
}).parseSync()

export interface ServerI {
  port: number
  dnsport: number
  host: string
  storage: string
  ipfsProvider: IPFSProvider
}

const cfg: ServerI = {
  port: Number(argv.port ?? process.env.PORT ?? '8080'),
  dnsport: Number(argv.dnsport ?? process.env.DNSPORT ?? '53'),
  host: argv.host ?? process.env.HOST ?? 'localhost',
  storage: argv.data ?? paths.data,
  ipfsProvider: (argv.ipfsProvider as IPFSProvider) ?? BUILTIN
}

const server = await apiBuilder({
  ...cfg,
  useLogging: true,
  useSwagger: true,
  usePrometheus: true,
  useSigIntHandler: true,
  useWebringDirectoryListing: true
})
server.listen(cfg, (err, _address) => {
  if (err != null) {
    server.log.error(err)
    process.exit(1)
  }
})
