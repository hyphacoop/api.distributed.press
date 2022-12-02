import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import fastify, { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swagger_ui from '@fastify/swagger-ui'
import metrics from 'fastify-metrics'
import { siteRoutes } from './sites.js'
import { adminRoutes } from './admin.js'
import { publisherRoutes } from './publisher.js'

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
  usePrometheus: boolean
}

async function apiBuilder (cfg: Partial<APIConfig>): Promise<FastifyTypebox> {
  const server = fastify({ logger: cfg.useLogging }).withTypeProvider<TypeBoxTypeProvider>()
  await server.register(multipart)

  server.get('/healthz', () => {
    return 'ok\n'
  })

  await server.register(v1Routes(cfg), { prefix: '/v1' })
  await server.ready()
  return server
}

const v1Routes = (cfg: Partial<APIConfig>) => async (server: FastifyTypebox): Promise<void> => {
  if (cfg.usePrometheus ?? false) {
    server.register(metrics, { endpoint: '/metrics' });
  }

  if (cfg.useSwagger ?? false) {
    await server.register(swagger, {
      swagger: {
        info: {
          title: 'Distributed Press API',
          description: 'Documentation on how to use the Distributed Press API to publish your website content and the Distributed Press API for your project',
          version: '1.0.0'
        },
        tags: [
          { name: 'site', description: 'Managing site deployments' },
          { name: 'publisher', description: 'Publisher account management. Publishers can manage site deployments' },
          { name: 'admin', description: 'Admin management. Admins can create, modify, and delete publishers' }
        ]
      }
    })

    await server.register(swagger_ui, {
      routePrefix: '/docs'
    })
  }

  // Register Routes
  await server.register(siteRoutes)
  await server.register(publisherRoutes)
  await server.register(adminRoutes)

  if (cfg.useSwagger ?? false) {
    server.swagger()
    server.log.info('Registered Swagger endpoints')
  }
}

export default apiBuilder
