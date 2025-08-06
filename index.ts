// Polyfill CustomEvent for Node.js environment
// Shim Web Crypto API to global scope for browser-compatible libraries
import { webcrypto } from 'node:crypto'

import apiBuilder from './api/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'

if (typeof CustomEvent === 'undefined') {
  class CustomEvent<T = any> extends Event {
    detail: T
    constructor (type: string, options?: CustomEventInit<T>) {
      super(type, options)
      this.detail = options?.detail as T
    }
  }
  (globalThis as any).CustomEvent = CustomEvent
}
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto
}
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
  host: argv.host ?? process.env.HOST ?? '0.0.0.0',
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
