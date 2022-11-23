import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import fastify, { FastifyInstance } from "fastify"
import { siteRoutes } from "./sites"
import multipart from "@fastify/multipart"

function apiBuilder(logging = false) {
  const server = fastify({
    logger: logging
  })
    .register(multipart) // TODO: discuss whether we want to set a filesize limit
    .withTypeProvider<TypeBoxTypeProvider>()

  server.get('/healthz', async (_request, _reply) => {
    return 'ok\n'
  })

  server.register(v1Routes, { prefix: "/v1" })
  return server
}

async function v1Routes(server: FastifyInstance) {
  server.register(siteRoutes)
}

export default apiBuilder
