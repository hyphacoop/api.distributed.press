import fastify from "fastify"

function makeServer(logging = false) {
  const server = fastify({
    logger: logging
  })

  server.get('/healthz', async (_request, _reply) => {
    return 'ok\n'
  })

  return server
}

export default makeServer
