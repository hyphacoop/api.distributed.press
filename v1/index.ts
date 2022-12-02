import apiBuilder from './api/index.js'

const PORT = Number(process.env.PORT ?? '8080')
const server = await apiBuilder({ useLogging: true, useSwagger: true, usePrometheus: true })
server.listen({ port: PORT }, (err, _address) => {
  if (err != null) {
    server.log.error(err)
    process.exit(1)
  }
})
