import apiBuilder from './api/index.js'

interface ServerI {
  port?: number,
  host?: string,
}

const PORT = Number(process.env.PORT ?? '8080')
const cfg: ServerI = {
  port: PORT
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
