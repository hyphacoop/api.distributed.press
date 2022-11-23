import makeServer from './api'

const PORT = Number(process.env.PORT) || 8080
const server = makeServer(true)
server.listen({ port: PORT }, (err, _address) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
