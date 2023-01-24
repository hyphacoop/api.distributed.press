import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import fastify, { FastifyBaseLogger, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault, FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swagger_ui from '@fastify/swagger-ui'
import metrics from 'fastify-metrics'
import { siteRoutes } from './sites.js'
import { adminRoutes } from './admin.js'
import { publisherRoutes } from './publisher.js'
import Store, { StoreI } from '../config/index.js'
import { registerAuth } from '../authorization/cfg.js'
import { MemoryLevel } from 'memory-level'
import { authRoutes } from './auth.js'
import { ServerI } from '../index.js'
import { Level } from 'level'

export type FastifyTypebox = FastifyInstance<
RawServerDefault,
RawRequestDefaultExpression<RawServerDefault>,
RawReplyDefaultExpression<RawServerDefault>,
FastifyBaseLogger,
TypeBoxTypeProvider
>

export type APIConfig = Partial<{
  useLogging: boolean
  useSwagger: boolean
  usePrometheus: boolean
  useMemoryBackedDB: boolean
}> & ServerI

async function apiBuilder (cfg: APIConfig): Promise<FastifyTypebox> {
  const db = cfg.useMemoryBackedDB === true
    ? new MemoryLevel({ valueEncoding: 'json' })
    : new Level('store', { valueEncoding: 'json' })
  const store = new Store(cfg, db)

  const server = fastify({ logger: cfg.useLogging }).withTypeProvider<TypeBoxTypeProvider>()
  await registerAuth(cfg, server, store)
  await server.register(multipart, { attachFieldsToBody: 'keyValues' })

  server.get('/healthz', () => {
    return 'ok\n'
  })

  await server.register(v1Routes(cfg, store), { prefix: '/v1' })
  await server.ready()
  return server
}

const v1Routes = (cfg: APIConfig, store: StoreI) => async (server: FastifyTypebox): Promise<void> => {
  if (cfg.usePrometheus ?? false) {
    await server.register(metrics, { endpoint: '/metrics' })
  }

  if (cfg.useSwagger ?? false) {
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'Distributed Press API',
          description: 'Documentation on how to use the Distributed Press API to publish your website content and the Distributed Press API for your project',
          version: '1.0.0'
        },
        tags: [
          { name: 'site', description: 'Managing site deployments' },
          { name: 'publisher', description: 'Publisher account management. Publishers can manage site deployments' },
          { name: 'admin', description: 'Admin management. Admins can create, modify, and delete publishers' }
        ],
        components: {
          securitySchemes: {
            jwt: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'String containing the full JWT token'
            }
          }
        }
      }
    })

    await server.register(swagger_ui, {
      routePrefix: '/docs'
    })
  }

  // Register Routes
  await server.register(authRoutes(store))
  await server.register(siteRoutes(store))
  await server.register(publisherRoutes(store))
  await server.register(adminRoutes(store))

  if (cfg.useSwagger ?? false) {
    server.swagger()
    server.log.info('Registered Swagger endpoints')
  }
}

export default apiBuilder
