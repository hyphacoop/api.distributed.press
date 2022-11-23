import apiBuilder from './api'

const PORT = Number(process.env.PORT ?? '8080')
const server = apiBuilder(true)
server.listen({ port: PORT }, (err, _address) => {
  if (err != null) {
    server.log.error(err)
    process.exit(1)
  }
})
