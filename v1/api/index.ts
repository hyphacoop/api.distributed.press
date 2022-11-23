import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import fastify, { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify'
import { siteRoutes } from './sites'
import multipart from '@fastify/multipart'

export type FastifyTypebox = FastifyInstance<
RawServerDefault,
RawRequestDefaultExpression<RawServerDefault>,
RawReplyDefaultExpression<RawServerDefault>,
FastifyBaseLogger,
TypeBoxTypeProvider
>

function apiBuilder (logging = false): FastifyTypebox {
  const server = fastify({
    logger: logging
  })
    .register(multipart) // TODO: discuss whether we want to set a filesize limit
    .withTypeProvider<TypeBoxTypeProvider>()

  server.get('/healthz', () => {
    return 'ok\n'
  })

  void server.register(v1Routes, { prefix: '/v1' })
  return server
}

async function v1Routes (server: FastifyTypebox): Promise<void> {
  await server.register(siteRoutes)
}

export default apiBuilder
