import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import fastify, {
  FastifyBaseLogger,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  FastifyInstance
} from 'fastify'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swagger_ui from '@fastify/swagger-ui'
import metrics from 'fastify-metrics'

import path from 'node:path'
import envPaths from 'env-paths'

import { Level } from 'level'
import { MemoryLevel } from 'memory-level'
import pMap from 'p-map'

import { siteRoutes } from './sites.js'
import { adminRoutes } from './admin.js'
import { publisherRoutes } from './publisher.js'
import Store, { StoreI } from '../config/index.js'
import { registerAuth } from '../authorization/cfg.js'
import { authRoutes } from './auth.js'
import { ServerI } from '../index.js'
import { ConcreteProtocolManager } from '../protocols/index.js'
import { initDnsServer } from '../dns/index.js'

const paths = envPaths('distributed-press')

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
  useSigIntHandler: boolean
  useWebringDirectoryListing: boolean
}> & ServerI

async function apiBuilder (cfg: APIConfig): Promise<FastifyTypebox> {
  const basePath = cfg.storage ?? paths.data
  const cfgStoragePath = path.join(basePath, 'cfg')
  const db = cfg.useMemoryBackedDB === true
    ? new MemoryLevel({ valueEncoding: 'json' })
    : new Level(cfgStoragePath, { valueEncoding: 'json' })

  const protocolStoragePath = path.join(basePath, 'protocols')
  const protocols = new ConcreteProtocolManager({
    ipfs: {
      path: path.join(protocolStoragePath, 'ipfs'),
      provider: cfg.ipfsProvider
    },
    hyper: {
      path: path.join(protocolStoragePath, 'hyper')
    },
    http: {
      path: path.join(protocolStoragePath, 'http')
    }
  })

  const server = fastify({ logger: cfg.useLogging }).withTypeProvider<TypeBoxTypeProvider>()
  server.log.info('Initializing protocols')
  await protocols.load()
  const store = new Store(cfg, db, protocols)

  server.log.info('Initializing DNS server')
  const dns = await initDnsServer(cfg.dnsport, store.sites, server.log)

  server.log.info('Done')
  await registerAuth(cfg, server, store)
  await server.register(multipart)

  /*
  // pre-sync all sites
  const allSites = await store.sites.keys()
  await pMap(allSites, async (siteId) => {
    server.log.info(`Presyncing site: ${siteId}`)
    const fp = store.fs.getPath(siteId)
    await store.sites.sync(siteId, fp, { logger: server.log })
    server.log.info(`Finished presync: ${siteId}`)
  }, { concurrency: 1 })
  */

  // handle cleanup on shutdown
  server.addHook('onClose', async server => {
    server.log.info('Begin shutdown, unloading protocols...')
    await dns.close()
    await protocols.unload()
      .then(() => {
        server.log.info('Done')
      })
      .catch(err => {
        server.log.fatal(err)
      })
  })

  // catch SIGINTs
  if (cfg.useSigIntHandler === true) {
    process.on('SIGINT', () => {
      server.log.warn('Caught SIGINT')
      server.close(() => {
        process.exit()
      })
    })
  }

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
  await server.register(authRoutes(cfg, store))
  await server.register(siteRoutes(cfg, store))
  await server.register(publisherRoutes(cfg, store))
  await server.register(adminRoutes(cfg, store))

  if (cfg.useSwagger ?? false) {
    server.swagger()
    server.log.info('Registered Swagger endpoints')
  }
}

export default apiBuilder
