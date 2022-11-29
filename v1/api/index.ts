import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import fastify, { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault, RegisterOptions } from 'fastify'
import { siteRoutes } from './sites'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swagger_ui from '@fastify/swagger-ui'
import { adminRoutes } from './admin'
import { publisherRoutes } from './publisher'

export type FastifyTypebox = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>

interface APIConfig {
  useLogging: boolean
  useSwagger: boolean
}

async function apiBuilder({ useLogging, useSwagger }: Partial<APIConfig>): Promise<FastifyTypebox> {
  const server = fastify({ logger: useLogging }).withTypeProvider<TypeBoxTypeProvider>()
  await server.register(multipart) // TODO: discuss whether we want to set a filesize limit

  server.get('/healthz', () => {
    return 'ok\n'
  })

  await server.register(v1Routes(useSwagger ?? false), { prefix: '/v1' })
  await server.ready()
  return server
}

const v1Routes = (useSwagger: boolean) => async (server: FastifyTypebox): Promise<void> => {
  if (useSwagger) {
    await server.register(swagger, {
      swagger: {
        info: {
          title: 'Distributed Press API',
          description: 'Documentation on how to use the Distributed Press API to publish your website content and the Distributed Press API for your project',
          version: '1.0.0'
        }, tags: [
          { name: 'site', description: 'Managing site deployments' },
          { name: 'publisher', description: 'Publisher account management' },
          { name: 'admin', description: 'Admin account management' },
        ],
      },
    })

    await server.register(swagger_ui, {
      routePrefix: '/docs',
    })
  }

  // Register Routes
  await server.register(siteRoutes)
  await server.register(publisherRoutes)
  await server.register(adminRoutes)

  if (useSwagger) {
    server.swagger()
    server.log.info("Registered Swagger endpoints")
  }
}

export default apiBuilder
