import apiBuilder from './api/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
const paths = envPaths('distributed-press')

const argv = yargs(hideBin(process.argv)).options({
  port: { type: 'number' },
  dnsport: { type: 'number' },
  host: { type: 'string' },
  domain: { type: 'string' },
  data: { type: 'string' },
  useWebRTC: { type: 'boolean', default: undefined }
}).parseSync()

export interface ServerI {
  port: number
  dnsport: number
  host: string
  domain: string
  storage: string
  useWebRTC?: boolean
}

const cfg: ServerI = {
  port: Number(argv.port ?? process.env.PORT ?? '8080'),
  dnsport: Number(argv.dnsport ?? process.env.DNSPORT ?? '53'),
  host: argv.host ?? process.env.HOST ?? 'localhost',
  domain: argv.domain ?? process.env.DOMAIN ?? 'localhost',
  storage: argv.data ?? paths.data,
  useWebRTC: argv.useWebRTC ?? (process.env.USE_WEBRTC?.toLowerCase() === 'false' ? false : process.env.CI !== 'true')
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
