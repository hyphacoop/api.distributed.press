import apiBuilder from './api'

const PORT = Number(process.env.PORT ?? '8080')

apiBuilder({ useLogging: true, useSwagger: true })
  .then(server => server.listen({ port: PORT }, (err, _address) => {
    if (err != null) {
      server.log.error(err)
      process.exit(1)
    }
  }))
  .catch(err => console.error(err))
