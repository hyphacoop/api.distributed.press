import apiBuilder from './api/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
const paths = envPaths('distributed-press')

const argv = yargs(hideBin(process.argv)).options({
  port: { type: 'number' },
  host: { type: 'string' },
  data: { type: 'string' }
}).parseSync()

interface ServerI {
  port: number
  host?: string
  storage: string
}

const PORT = Number(argv.port ?? process.env.PORT ?? '8080')
const cfg: ServerI = {
  port: PORT,
  storage: argv.data ?? paths.data
}

if (process.env.HOST !== undefined) {
  cfg.host = process.env.HOST
}

const server = await apiBuilder({ useLogging: true, useSwagger: true, usePrometheus: true })
server.listen(cfg, (err, _address) => {
  if (err != null) {
    server.log.error(err)
    process.exit(1)
  }
})
